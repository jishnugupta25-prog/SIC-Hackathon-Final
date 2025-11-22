-- Crime Report Portal - Database Schema Setup
-- Run this SQL on Render PostgreSQL Console

CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar UNIQUE,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "password_hash" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "emergency_contacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar,
  "phone_number" varchar,
  "relationship" varchar,
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "crime_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "crime_type" varchar,
  "description" text,
  "latitude" real,
  "longitude" real,
  "address" text,
  "is_anonymous" boolean DEFAULT false,
  "reported_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "sos_alerts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "latitude" real,
  "longitude" real,
  "address" text,
  "sent_to" text[],
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions"("expire");
