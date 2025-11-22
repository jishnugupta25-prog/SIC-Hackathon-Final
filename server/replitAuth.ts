// From javascript_log_in_with_replit blueprint
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import MemoryStore from "memorystore";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  let sessionStore: any;
  
  if (process.env.DATABASE_URL) {
    // Use PostgreSQL session store
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    // Use in-memory session store for development/SQLite
    const memoryStore = MemoryStore(session);
    sessionStore = new memoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
      ttl: sessionTtl,
    });
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization for email/password auth
  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: any, done) => {
    done(null, user);
  });

  // Test login endpoint (for development/testing only)
  app.get('/api/test-login', async (req: any, res) => {
    try {
      const testUser = {
        claims: {
          sub: 'test-user-' + Date.now(),
          email: 'testuser@example.com',
          first_name: 'Test',
          last_name: 'User',
        },
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
      };

      // Create/upsert test user in database
      await storage.upsertUser({
        id: testUser.claims.sub,
        email: testUser.claims.email,
        firstName: testUser.claims.first_name,
        lastName: testUser.claims.last_name,
      });

      // Set user in session
      req.user = testUser;
      req.login(testUser, (err: any) => {
        if (err) return res.status(500).json({ message: 'Login failed' });
        res.redirect('/');
      });
    } catch (error) {
      console.error('Test login error:', error);
      res.status(500).json({ message: 'Test login failed' });
    }
  });

  // Only setup Replit OAuth if REPL_ID is available (running on Replit)
  const isReplitEnv = !!process.env.REPL_ID;
  let config: any = null;

  if (isReplitEnv) {
    config = await getOidcConfig();

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      verified(null, user);
    };

    // Keep track of registered strategies
    const registeredStrategies = new Set<string>();

    // Helper function to ensure strategy exists for a domain
    const ensureStrategy = (domain: string) => {
      const strategyName = `replitauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const strategy = new Strategy(
          {
            name: strategyName,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify,
        );
        passport.use(strategy);
        registeredStrategies.add(strategyName);
      }
    };

    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  } else {
    // Fallback logout for non-Replit environments (Render, etc.)
    app.get("/api/logout", (req, res) => {
      req.logout(() => {
        res.json({ success: true });
      });
    });
  }
}

export const isAuthenticated = ((req: any, res: any, next: any) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
}) as RequestHandler;
