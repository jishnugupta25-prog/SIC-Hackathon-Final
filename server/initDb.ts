// Auto-initialize database schema on startup
export async function initializeDatabase() {
  try {
    console.log("Initializing database schema...");
    
    const isPostgres = process.env.DATABASE_URL ? true : false;
    
    if (isPostgres) {
      // PostgreSQL initialization
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const ws = await import("ws");
      
      neonConfig.webSocketConstructor = ws.default;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      const createTablesSql = `
        CREATE TABLE IF NOT EXISTS "users" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" text UNIQUE,
          "first_name" text,
          "last_name" text,
          "profile_image_url" text,
          "password_hash" text,
          "created_at" timestamp DEFAULT current_timestamp,
          "updated_at" timestamp DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "sessions" (
          "sid" text PRIMARY KEY,
          "sess" jsonb NOT NULL,
          "expire" timestamp NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "emergency_contacts" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" text,
          "phone_number" text,
          "relationship" text,
          "created_at" timestamp DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "crime_reports" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "crime_type" text,
          "description" text,
          "latitude" numeric,
          "longitude" numeric,
          "address" text,
          "is_anonymous" integer DEFAULT 0,
          "reported_at" timestamp DEFAULT current_timestamp,
          "created_at" timestamp DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "sos_alerts" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "latitude" numeric,
          "longitude" numeric,
          "address" text,
          "sent_to" text[],
          "created_at" timestamp DEFAULT current_timestamp
        );

        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions"("expire");
      `;
      
      // Execute each statement separately for PostgreSQL
      const statements = createTablesSql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement + ';');
        }
      }
      
      await pool.end();
    } else {
      // SQLite initialization
      const Database = await import('better-sqlite3');
      const sqlite = new Database.default('/tmp/crime-portal.db');
      
      const createTablesSql = `
        CREATE TABLE IF NOT EXISTS "users" (
          "id" text PRIMARY KEY,
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
          "sess" json NOT NULL,
          "expire" datetime NOT NULL
        );

        CREATE TABLE IF NOT EXISTS "emergency_contacts" (
          "id" text PRIMARY KEY,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" text,
          "phone_number" text,
          "relationship" text,
          "created_at" datetime DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "crime_reports" (
          "id" text PRIMARY KEY,
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
          "id" text PRIMARY KEY,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "latitude" real,
          "longitude" real,
          "address" text,
          "sent_to" json,
          "created_at" datetime DEFAULT current_timestamp
        );

        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions"("expire");
      `;
      
      const statements = createTablesSql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          sqlite.exec(statement + ';');
        }
      }
      
      sqlite.close();
    }
    
    console.log("✅ Database schema initialized successfully");
  } catch (error: any) {
    console.error("❌ Database schema initialization error:", error?.message);
    throw error;
  }
}
