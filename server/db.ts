// Database Layer - Auto-detects PostgreSQL or SQLite
import * as schema from "@shared/schema";

let db: any;
let dbInitialized = false;

export async function initializeDb() {
  if (dbInitialized) return;
  
  if (process.env.DATABASE_URL) {
    // Use PostgreSQL when DATABASE_URL is available
    console.log("📊 Using PostgreSQL database");
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const ws = await import("ws");

    neonConfig.webSocketConstructor = ws.default;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
  } else {
    // Use SQLite when DATABASE_URL is not set (zero config)
    console.log("📊 Using SQLite database (zero-config mode)");
    const Database = await import('better-sqlite3');
    const { drizzle } = await import('drizzle-orm/better-sqlite3');
    
    const sqlite = new Database.default('/tmp/crime-portal.db');
    db = drizzle({ client: sqlite, schema });
  }
  
  dbInitialized = true;
}

export async function getDb() {
  await initializeDb();
  return db;
}

// Export for direct access (lazy initialized)
let cachedDb: any = null;

async function ensureDb() {
  if (!cachedDb) {
    await initializeDb();
    cachedDb = db;
  }
  return cachedDb;
}

export { ensureDb as db };
