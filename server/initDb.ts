// Auto-initialize database schema on startup
import { getDb } from "./db";

export async function initializeDatabase() {
  try {
    console.log("Initializing database schema...");
    const db = await getDb();
    
    // Create all tables if they don't exist
    // Works with both PostgreSQL and SQLite
    const isPostgres = process.env.DATABASE_URL ? true : false;
    
    // PostgreSQL uses gen_random_uuid(), SQLite uses random()
    const idDefault = isPostgres ? 'gen_random_uuid()' : "lower(hex(randomblob(16)))";
    const jsonbType = isPostgres ? 'jsonb' : 'json';
    const textArray = isPostgres ? 'text[]' : 'text';
    
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY DEFAULT ${idDefault},
        "email" text UNIQUE,
        "first_name" text,
        "last_name" text,
        "profile_image_url" text,
        "password_hash" text,
        "created_at" datetime DEFAULT current_timestamp,
        "updated_at" datetime DEFAULT current_timestamp
      );

      CREATE TABLE IF NOT EXISTS "sessions" (
        "sid" text PRIMARY KEY,
        "sess" ${jsonbType} NOT NULL,
        "expire" datetime NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "emergency_contacts" (
        "id" text PRIMARY KEY DEFAULT ${idDefault},
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "name" text,
        "phone_number" text,
        "relationship" text,
        "created_at" datetime DEFAULT current_timestamp
      );

      CREATE TABLE IF NOT EXISTS "crime_reports" (
        "id" text PRIMARY KEY DEFAULT ${idDefault},
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "crime_type" text,
        "description" text,
        "latitude" real,
        "longitude" real,
        "address" text,
        "is_anonymous" integer DEFAULT 0,
        "reported_at" datetime DEFAULT current_timestamp,
        "created_at" datetime DEFAULT current_timestamp
      );

      CREATE TABLE IF NOT EXISTS "sos_alerts" (
        "id" text PRIMARY KEY DEFAULT ${idDefault},
        "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "latitude" real,
        "longitude" real,
        "address" text,
        "sent_to" ${textArray},
        "created_at" datetime DEFAULT current_timestamp
      );

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions"("expire");
    `;
    
    await db.execute(createTableSql);
    
    console.log("✅ Database schema initialized successfully");
  } catch (error: any) {
    // Log but don't crash - tables might already exist
    console.warn("⚠️ Database schema initialization warning:", error?.message);
  }
}
