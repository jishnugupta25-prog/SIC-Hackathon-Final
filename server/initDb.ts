// Auto-initialize database schema on startup
export async function initializeDatabase() {
  try {
    console.log("Initializing database schema...");
    
    // Import bcrypt for password hashing
    const bcrypt = await import("bcryptjs");
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
          "reference_number" varchar(10) UNIQUE NOT NULL,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "crime_type" text,
          "description" text,
          "latitude" numeric,
          "longitude" numeric,
          "address" text,
          "phone_number" text NOT NULL,
          "is_anonymous" integer DEFAULT 0,
          "reported_at" timestamp DEFAULT current_timestamp,
          "created_at" timestamp DEFAULT current_timestamp,
          "evidence_urls" text,
          "voice_message_url" text
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

        CREATE TABLE IF NOT EXISTS "admins" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "email" text UNIQUE NOT NULL,
          "password_hash" text NOT NULL,
          "full_name" text,
          "created_at" timestamp DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "crime_approvals" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "crime_id" text NOT NULL REFERENCES "crime_reports"("id") ON DELETE CASCADE,
          "admin_id" text NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
          "status" text NOT NULL,
          "reviewed_at" timestamp,
          "created_at" timestamp DEFAULT current_timestamp,
          UNIQUE("crime_id")
        );

        CREATE TABLE IF NOT EXISTS "admin_feedback" (
          "id" text PRIMARY KEY DEFAULT gen_random_uuid(),
          "crime_id" text NOT NULL REFERENCES "crime_reports"("id") ON DELETE CASCADE,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "admin_id" text NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
          "message" text NOT NULL,
          "is_read" integer DEFAULT 0,
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
          "reference_number" text UNIQUE NOT NULL,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "crime_type" text,
          "description" text,
          "latitude" real,
          "longitude" real,
          "address" text,
          "phone_number" text NOT NULL,
          "is_anonymous" integer DEFAULT 0,
          "reported_at" datetime DEFAULT current_timestamp,
          "created_at" datetime DEFAULT current_timestamp,
          "evidence_urls" text,
          "voice_message_url" text
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

        CREATE TABLE IF NOT EXISTS "admins" (
          "id" text PRIMARY KEY,
          "email" text UNIQUE NOT NULL,
          "password_hash" text NOT NULL,
          "full_name" text,
          "created_at" datetime DEFAULT current_timestamp
        );

        CREATE TABLE IF NOT EXISTS "crime_approvals" (
          "id" text PRIMARY KEY,
          "crime_id" text NOT NULL REFERENCES "crime_reports"("id") ON DELETE CASCADE,
          "admin_id" text NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
          "status" text NOT NULL,
          "reviewed_at" datetime,
          "created_at" datetime DEFAULT current_timestamp,
          UNIQUE("crime_id")
        );

        CREATE TABLE IF NOT EXISTS "admin_feedback" (
          "id" text PRIMARY KEY,
          "crime_id" text NOT NULL REFERENCES "crime_reports"("id") ON DELETE CASCADE,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "admin_id" text NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
          "message" text NOT NULL,
          "is_read" integer DEFAULT 0,
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
    
    // Seed default admin if none exists
    await seedDefaultAdmin(isPostgres, bcrypt.default);
    
    console.log("✅ Database schema initialized successfully");
  } catch (error: any) {
    console.error("❌ Database schema initialization error:", error?.message);
    throw error;
  }
}

// Seed default admin account
async function seedDefaultAdmin(isPostgres: boolean, bcrypt: any) {
  try {
    const crypto = await import('crypto');
    const defaultEmail = "admin@crimereport.local";
    const defaultPassword = "admin@123";
    
    if (isPostgres) {
      const { Pool, neonConfig } = await import('@neondatabase/serverless');
      const ws = await import("ws");
      
      neonConfig.webSocketConstructor = ws.default;
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      // Check if admin already exists
      const result = await pool.query(
        'SELECT id FROM admins WHERE email = $1',
        [defaultEmail]
      );
      
      if (result.rowCount === 0) {
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const adminId = crypto.randomUUID();
        
        await pool.query(
          'INSERT INTO admins (id, email, password_hash, full_name) VALUES ($1, $2, $3, $4)',
          [adminId, defaultEmail, passwordHash, "System Administrator"]
        );
        
        console.log(`✅ Default admin created: ${defaultEmail}`);
      }
      
      await pool.end();
    } else {
      const Database = await import('better-sqlite3');
      const sqlite = new Database.default('/tmp/crime-portal.db');
      
      // Check if admin already exists
      const stmt = sqlite.prepare('SELECT id FROM admins WHERE email = ?');
      const admin = stmt.get(defaultEmail);
      
      if (!admin) {
        const passwordHash = await bcrypt.hash(defaultPassword, 10);
        const adminId = crypto.randomUUID();
        
        const insertStmt = sqlite.prepare(
          'INSERT INTO admins (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)'
        );
        insertStmt.run(adminId, defaultEmail, passwordHash, "System Administrator");
        
        console.log(`✅ Default admin created: ${defaultEmail}`);
      }
      
      sqlite.close();
    }
  } catch (error: any) {
    // Don't throw - this is non-critical
    console.warn(`⚠️  Could not seed default admin: ${error.message}`);
  }
}
