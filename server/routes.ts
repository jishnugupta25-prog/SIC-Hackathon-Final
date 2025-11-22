// Crime Report Portal - API Routes
// From javascript_log_in_with_replit blueprint

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { sendSosMessage } from "./twilio";
import { analyzeCrimePatterns } from "./gemini";
import { insertEmergencyContactSchema, insertCrimeReportSchema, insertSosAlertSchema } from "@shared/schema";
import * as bcrypt from "bcryptjs";
import { initializeDatabase } from "./initDb";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database schema on startup (auto-creates tables if needed)
  await initializeDatabase();
  
  // Auth middleware
  await setupAuth(app);

  // Email/Password Auth Routes
  app.post('/api/signup', async (req: any, res) => {
    try {
      const { email, firstName, lastName, password } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.upsertUser({
        id: undefined as any,
        email,
        firstName,
        lastName,
        passwordHash,
      });

      // Create session
      req.user = {
        claims: { sub: user.id },
        access_token: 'email-auth',
        refresh_token: 'email-auth',
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      };

      req.login(req.user, (err: any) => {
        if (err) return res.status(500).json({ message: 'Session creation failed' });
        res.json({ success: true, user });
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  app.post('/api/email-login', async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      req.user = {
        claims: { sub: user.id },
        access_token: 'email-auth',
        refresh_token: 'email-auth',
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
      };

      req.login(req.user, (err: any) => {
        if (err) return res.status(500).json({ message: 'Session creation failed' });
        res.json({ success: true, user });
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message || "Login failed" });
    }
  });

  app.get('/api/auth/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) return res.status(500).json({ message: 'Logout failed' });
      res.redirect('/login');
    });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Emergency Contacts routes
  app.get('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contacts = await storage.getEmergencyContacts(userId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const contactData = insertEmergencyContactSchema.parse({
        ...req.body,
        userId,
      });
      const contact = await storage.createEmergencyContact(contactData);

      // Send confirmation SMS to the emergency contact (India-friendly)
      try {
        const userName = user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.email || "User";
        
        const confirmationMsg = `Hello! ${userName} has added your number as an emergency contact in the Crime Report Portal. You will receive alerts if they trigger the SOS button. If this wasn't you, please contact them.`;
        
        const client = await (await import('./twilio')).getTwilioClient();
        const { formatPhoneNumber } = await import('./twilio');
        const formattedPhone = (await import('./twilio')).formatPhoneNumber || ((p: string) => p);
        
        // Try to send but don't fail the contact creation if SMS fails
        try {
          const twilioFrom = await (await import('./twilio')).getTwilioFromPhoneNumber();
          const formattedTo = (require('./twilio') as any).formatPhoneNumber?.(contact.phoneNumber) || 
            (contact.phoneNumber.startsWith('+') ? contact.phoneNumber : '+91' + contact.phoneNumber.replace(/^0/, ''));
          
          if (formattedTo !== twilioFrom) {
            await client.messages.create({
              body: confirmationMsg,
              from: twilioFrom,
              to: formattedTo,
            });
            console.log(`✓ Confirmation SMS sent to ${contact.phoneNumber}`);
          }
        } catch (smsError) {
          console.warn(`SMS confirmation failed (non-critical): ${smsError}`);
          // Don't fail the contact creation if SMS fails
        }
      } catch (smsError) {
        console.warn(`Could not send confirmation SMS: ${smsError}`);
        // Continue anyway - contact creation is still successful
      }

      res.json(contact);
    } catch (error: any) {
      console.error("Error creating contact:", error);
      res.status(400).json({ message: error.message || "Failed to create contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contactId = req.params.id;
      await storage.deleteEmergencyContact(contactId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Crime Reports routes
  app.get('/api/crimes', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getCrimeReports();
      res.json(crimes);
    } catch (error) {
      console.error("Error fetching crimes:", error);
      res.status(500).json({ message: "Failed to fetch crimes" });
    }
  });

  app.get('/api/crimes/recent', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getRecentCrimeReports(20);
      res.json(crimes);
    } catch (error) {
      console.error("Error fetching recent crimes:", error);
      res.status(500).json({ message: "Failed to fetch recent crimes" });
    }
  });

  app.post('/api/crimes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const crimeData = insertCrimeReportSchema.parse({
        ...req.body,
        userId,
      });
      const crime = await storage.createCrimeReport(crimeData);
      res.json(crime);
    } catch (error: any) {
      console.error("Error creating crime report:", error);
      res.status(400).json({ message: error.message || "Failed to create crime report" });
    }
  });

  // SOS Alert routes
  app.post('/api/sos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { latitude, longitude, address } = req.body;
      
      // Get user's emergency contacts
      const contacts = await storage.getEmergencyContacts(userId);
      
      if (contacts.length === 0) {
        return res.status(400).json({ message: "No emergency contacts found" });
      }

      // Send SMS to all contacts
      const userName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email || "Unknown";

      const sentTo: string[] = [];
      for (const contact of contacts) {
        try {
          await sendSosMessage(contact.phoneNumber, userName, { latitude, longitude });
          sentTo.push(contact.phoneNumber);
        } catch (error) {
          console.error(`Failed to send to ${contact.phoneNumber}:`, error);
        }
      }

      // Save SOS alert to database
      const alertData = insertSosAlertSchema.parse({
        userId,
        latitude,
        longitude,
        address: address || null,
        sentTo: sentTo, // Array of phone numbers
      });
      const alert = await storage.createSosAlert(alertData);

      res.json({ 
        success: true, 
        alert,
        sentCount: sentTo.length,
      });
    } catch (error: any) {
      console.error("Error sending SOS:", error);
      res.status(500).json({ message: error.message || "Failed to send SOS alert" });
    }
  });

  app.get('/api/sos-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getUserSosAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching SOS history:", error);
      res.status(500).json({ message: "Failed to fetch SOS history" });
    }
  });

  // AI Crime Analysis route
  app.get('/api/ai/crime-analysis', isAuthenticated, async (req: any, res) => {
    try {
      const crimes = await storage.getCrimeReports();
      const analysis = await analyzeCrimePatterns(crimes);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing crimes:", error);
      res.status(500).json({ message: "Failed to analyze crimes" });
    }
  });

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Get location suggestions using Google Maps Geocoding API
  app.get('/api/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("[Suggestions] Google Maps API key not configured");
        return res.json([]);
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&components=country:in`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Suggestions] HTTP ${response.status}`);
        return res.json([]);
      }

      const data = await response.json();
      if (data.status !== 'OK' || !Array.isArray(data.predictions)) {
        console.warn(`[Suggestions] API error: ${data.status}`);
        return res.json([]);
      }

      // Get detailed location for each prediction
      const suggestions = await Promise.all(
        data.predictions.slice(0, 8).map(async (prediction: any) => {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${apiKey}`;
            const detailResponse = await fetch(detailUrl, { signal: AbortSignal.timeout(3000) });
            
            if (!detailResponse.ok) return null;
            
            const detailData = await detailResponse.json();
            if (detailData.status !== 'OK' || !detailData.result?.geometry?.location) {
              return null;
            }

            return {
              displayName: prediction.description,
              latitude: detailData.result.geometry.location.lat,
              longitude: detailData.result.geometry.location.lng
            };
          } catch (error) {
            console.warn("[Suggestions] Error getting details:", error);
            return null;
          }
        })
      );

      const validSuggestions = suggestions.filter(Boolean);
      console.log(`[Suggestions] Found ${validSuggestions.length} results for "${query}"`);
      res.json(validSuggestions);
    } catch (error: any) {
      console.error("[Suggestions] Error:", error.message);
      res.json([]);
    }
  });

  // Reverse geocode - get place name from coordinates using Photon (free OSM service)
  app.get('/api/reverse-geocode', isAuthenticated, async (req: any, res) => {
    try {
      const lat = req.query.lat as string;
      const lon = req.query.lon as string;

      if (!lat || !lon) {
        return res.status(400).json({ message: "Latitude and longitude required" });
      }

      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      
      if (isNaN(numLat) || isNaN(numLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }

      console.log(`[Reverse Geocode] Reverse geocoding: ${numLat},${numLon}`);

      // Use Photon (OSM) - free reverse geocoding
      const photonUrl = `https://photon.komoot.io/reverse?lon=${numLon}&lat=${numLat}&limit=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      let response, data;
      try {
        response = await fetch(photonUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Crime-Report-Portal/1.0' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`[Reverse Geocode] Photon HTTP ${response.status}`);
          return res.json({ placeName: "My Location", hierarchy: [] });
        }

        data = await response.json();
      } catch (fetchError: any) {
        console.error(`[Reverse Geocode] Photon error: ${fetchError.message}`);
        clearTimeout(timeoutId);
        return res.json({ placeName: "My Location", hierarchy: [] });
      }
      
      if (!data.features || data.features.length === 0) {
        console.warn(`[Reverse Geocode] No results from Photon for ${numLat},${numLon}`);
        return res.json({ placeName: "My Location", hierarchy: [] });
      }

      const result = data.features[0];
      const properties = result.properties || {};
      
      // Build place name from properties
      const parts = [];
      if (properties.name) parts.push(properties.name);
      if (properties.city) parts.push(properties.city);
      if (properties.state) parts.push(properties.state);
      if (properties.country) parts.push(properties.country);
      
      const placeName = parts.length > 0 ? parts.join(', ') : 'My Location';
      
      // Build hierarchy
      const hierarchy: string[] = [];
      if (properties.name) hierarchy.push(properties.name);
      if (properties.city && properties.city !== properties.name) hierarchy.push(properties.city);
      if (properties.state) hierarchy.push(properties.state);
      if (properties.country) hierarchy.push(properties.country);

      console.log(`[Reverse Geocode] ✓ Success: ${numLat},${numLon} -> ${placeName}`);
      
      res.json({
        placeName: placeName,
        hierarchy: hierarchy,
        latitude: numLat,
        longitude: numLon
      });
    } catch (error: any) {
      console.error("[Reverse Geocode] Error:", error.message);
      res.json({ placeName: "My Location", hierarchy: [] });
    }
  });

  // Geocode place name to coordinates using Google Maps
  app.get('/api/geocode', isAuthenticated, async (req: any, res) => {
    try {
      const placeName = req.query.place as string;
      if (!placeName || placeName.trim().length === 0) {
        return res.status(400).json({ message: "Place name required" });
      }

      console.log(`[Geocode] Searching for: ${placeName}`);

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.warn("[Geocode] Google Maps API key not configured");
        return res.status(500).json({ message: "Location service unavailable" });
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&key=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[Geocode] HTTP ${response.status}`);
        return res.status(500).json({ message: "Geocoding service unavailable" });
      }

      const data = await response.json();
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        console.log(`[Geocode] No results found for: ${placeName}`);
        return res.status(404).json({ message: `No location found for "${placeName}". Try a larger city or region.` });
      }

      const location = data.results[0];
      const displayName = location.formatted_address;
      
      console.log(`[Geocode] Found: ${displayName}`);
      res.json({
        latitude: location.geometry.location.lat,
        longitude: location.geometry.location.lng,
        displayName: displayName
      });
    } catch (error: any) {
      console.error("[Geocode] Error:", error.message);
      res.status(500).json({ message: "Unable to search location. Please try again." });
    }
  });

  // Admin routes - real-time monitoring
  app.get('/api/admin/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const db = await (await import('./db')).getDb();
      const { sessions: sessionsTable, users: usersTable } = await import('@shared/schema');
      const { sql, eq } = await import('drizzle-orm');
      
      // Get all active sessions from the database
      const sessionList = await db.select().from(sessionsTable);
      
      // Fetch user info for each session
      const sessionsWithUsers = [];
      for (const session of sessionList) {
        try {
          const sess = session.sess as any;
          if (sess && sess.passport && sess.passport.user) {
            const userId = sess.passport.user.claims?.sub || sess.passport.user.id;
            if (userId) {
              const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
              if (user) {
                sessionsWithUsers.push({
                  userId: user.id,
                  email: user.email || '',
                  firstName: user.firstName,
                  lastName: user.lastName,
                  sessionExpire: session.expire,
                });
              }
            }
          }
        } catch (e) {
          console.warn("Error processing session:", e);
        }
      }
      
      res.json(sessionsWithUsers);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.get('/api/admin/reports', isAuthenticated, async (req: any, res) => {
    try {
      const db = await (await import('./db')).getDb();
      const { crimeReports: crimeReportsTable, users: usersTable } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');
      
      // Get all crime reports with user details
      const reports = await db
        .select({
          id: crimeReportsTable.id,
          userId: crimeReportsTable.userId,
          crimeType: crimeReportsTable.crimeType,
          description: crimeReportsTable.description,
          latitude: crimeReportsTable.latitude,
          longitude: crimeReportsTable.longitude,
          address: crimeReportsTable.address,
          isAnonymous: crimeReportsTable.isAnonymous,
          createdAt: crimeReportsTable.createdAt,
          userEmail: usersTable.email,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
        })
        .from(crimeReportsTable)
        .leftJoin(usersTable, eq(crimeReportsTable.userId, usersTable.id))
        .orderBy(desc(crimeReportsTable.createdAt));
      
      // Transform the response
      const formattedReports = reports.map((r: any) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail,
        userName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : undefined,
        crimeType: r.crimeType,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address,
        isAnonymous: r.isAnonymous,
        createdAt: r.createdAt,
      }));
      
      res.json(formattedReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Safe Places route using Overpass API (OpenStreetMap)
  app.get('/api/safe-places', isAuthenticated, async (req: any, res) => {
    try {
      const startTime = Date.now();
      const userLat = parseFloat(req.query.latitude as string);
      const userLon = parseFloat(req.query.longitude as string);
      
      // Validate coordinates
      if (isNaN(userLat) || isNaN(userLon)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      console.log(`[Safe Places] Fetching locations for: ${userLat}, ${userLon}`);

      // Priority-ordered search types with Overpass query tags
      const searchTypes = [
        { tags: 'amenity=police', type: 'police', priority: 1 },
        { tags: 'amenity=hospital OR amenity=doctors OR healthcare=hospital', type: 'hospital', priority: 2 },
        { tags: 'amenity=pharmacy', type: 'pharmacy', priority: 3 },
      ];

      const radius = 5000; // 5km in meters
      const safePlaces: any[] = [];
      const seenPlaces = new Set<string>();

      // Helper to convert bbox radius
      const delta = (radius / 111000); // rough conversion: 111km per degree
      const bbox = `${userLat - delta},${userLon - delta},${userLat + delta},${userLon + delta}`;

      // Fetch nearby places for each type using Overpass API
      const fetchPromises = searchTypes.map(async (searchType) => {
        try {
          // Overpass API query
          const overpassQuery = `[bbox:${bbox}];(node[${searchType.tags}];way[${searchType.tags}];);out center;`;
          const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Crime-Report-Portal/1.0' }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.warn(`[Safe Places] HTTP ${response.status} for ${searchType.type}`);
            return [];
          }

          const data = await response.json();
          
          if (!Array.isArray(data.elements)) {
            console.warn(`[Safe Places] Invalid response for ${searchType.type}`);
            return [];
          }

          return data.elements
            .filter((place: any) => place.lat && place.lon)
            .map((place: any) => {
              const placeId = `${place.type}-${place.id}`;
              
              // Skip duplicates
              if (seenPlaces.has(placeId)) return null;
              seenPlaces.add(placeId);

              // Get center point for ways
              const lat = place.center?.lat || place.lat;
              const lon = place.center?.lon || place.lon;
              
              const distance = calculateDistance(userLat, userLon, lat, lon);
              
              // Extract name and phone from tags
              const tags = place.tags || {};
              const name = tags.name || `${searchType.type.charAt(0).toUpperCase() + searchType.type.slice(1)}`;
              const phone = tags.phone || tags['contact:phone'] || "";
              const address = tags['addr:full'] || `${tags['addr:street'] || ''} ${tags['addr:housenumber'] || ''}`.trim() || 'No address available';

              return {
                id: placeId,
                name: name,
                type: searchType.type,
                latitude: lat,
                longitude: lon,
                address: address,
                phone: phone,
                distance: Math.round(distance * 1000) / 1000,
                priority: searchType.priority,
                rating: 0,
                isOpen: undefined
              };
            })
            .filter(Boolean)
            .slice(0, 10); // Limit to 10 results per type
        } catch (error: any) {
          console.warn(`[Safe Places] Error fetching ${searchType.type}:`, error.message);
          return [];
        }
      });

      // Execute all fetches in parallel
      const results = await Promise.all(fetchPromises);
      const allPlaces = results.flat();

      if (!allPlaces || allPlaces.length === 0) {
        console.warn(`[Safe Places] No locations found for ${userLat}, ${userLon}`);
        return res.json([]);
      }

      // Sort by priority, then distance
      allPlaces.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.distance - b.distance;
      });

      const fetchTime = Date.now() - startTime;
      console.log(`[Safe Places] ✓ Fetched ${allPlaces.length} places in ${fetchTime}ms. Police: ${allPlaces.filter(p => p.type === 'police').length}, Hospital: ${allPlaces.filter(p => p.type === 'hospital').length}, Pharmacy: ${allPlaces.filter(p => p.type === 'pharmacy').length}, With phones: ${allPlaces.filter(p => p.phone).length}`);

      res.json(allPlaces);
    } catch (error) {
      console.error("[Safe Places] Error:", error);
      res.json([]);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
