// Crime Report Portal - Complete Database Schema
// Following javascript_log_in_with_replit and javascript_database blueprints

import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - Required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Emergency Contacts table
export const emergencyContacts = pgTable("emergency_contacts", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  relationship: varchar("relationship", { length: 100 }),
  createdAt: timestamp("created_at"),
});

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  user: one(users, {
    fields: [emergencyContacts.userId],
    references: [users.id],
  }),
}));

export const insertEmergencyContactSchema = createInsertSchema(emergencyContacts).omit({
  id: true,
  createdAt: true,
});

export type InsertEmergencyContact = z.infer<typeof insertEmergencyContactSchema>;
export type EmergencyContact = typeof emergencyContacts.$inferSelect;

// Crime Reports table
export const crimeReports = pgTable("crime_reports", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  crimeType: varchar("crime_type", { length: 100 }).notNull(),
  description: text("description"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address"),
  isAnonymous: integer("is_anonymous").default(0), // 0=false, 1=true for SQLite compatibility
  reportedAt: timestamp("reported_at"),
  createdAt: timestamp("created_at"),
});

export const crimeReportsRelations = relations(crimeReports, ({ one }) => ({
  user: one(users, {
    fields: [crimeReports.userId],
    references: [users.id],
  }),
}));

export const insertCrimeReportSchema = createInsertSchema(crimeReports).omit({
  id: true,
  createdAt: true,
  reportedAt: true,
});

export type InsertCrimeReport = z.infer<typeof insertCrimeReportSchema>;
export type CrimeReport = typeof crimeReports.$inferSelect;

// SOS Alerts table - Track SOS button activations
// Using text field instead of array for SQLite compatibility
export const sosAlerts = pgTable("sos_alerts", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address"),
  sentTo: text("sent_to"), // Store as JSON string for cross-database compatibility
  createdAt: timestamp("created_at"),
});

export const sosAlertsRelations = relations(sosAlerts, ({ one }) => ({
  user: one(users, {
    fields: [sosAlerts.userId],
    references: [users.id],
  }),
}));

export const insertSosAlertSchema = createInsertSchema(sosAlerts).omit({
  id: true,
  createdAt: true,
}).extend({
  sentTo: z.union([z.array(z.string()), z.string()]).optional(),
});

export type InsertSosAlert = z.infer<typeof insertSosAlertSchema>;
export type SosAlert = typeof sosAlerts.$inferSelect;
