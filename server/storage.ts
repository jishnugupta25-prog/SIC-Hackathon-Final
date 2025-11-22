// Crime Report Portal - Database Storage Implementation
// From javascript_database and javascript_log_in_with_replit blueprints

import { randomUUID } from "node:crypto";
import {
  users,
  emergencyContacts,
  crimeReports,
  sosAlerts,
  type User,
  type UpsertUser,
  type EmergencyContact,
  type InsertEmergencyContact,
  type CrimeReport,
  type InsertCrimeReport,
  type SosAlert,
  type InsertSosAlert,
} from "@shared/schema";
import { getDb } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Emergency Contacts operations
  getEmergencyContacts(userId: string): Promise<EmergencyContact[]>;
  createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact>;
  deleteEmergencyContact(id: string, userId: string): Promise<void>;
  
  // Crime Reports operations
  getCrimeReports(): Promise<CrimeReport[]>;
  getRecentCrimeReports(limit?: number): Promise<CrimeReport[]>;
  getUserCrimeReports(userId: string): Promise<CrimeReport[]>;
  createCrimeReport(report: InsertCrimeReport): Promise<CrimeReport>;
  
  // SOS Alerts operations
  createSosAlert(alert: InsertSosAlert): Promise<SosAlert>;
  getUserSosAlerts(userId: string): Promise<SosAlert[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const db = await getDb();
    // For email-based signup, generate a new ID if not provided
    if (!userData.id) {
      const [user] = await db
        .insert(users)
        .values({ ...userData, id: randomUUID() })
        .returning();
      return user;
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Emergency Contacts operations
  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    const db = await getDb();
    return await db
      .select()
      .from(emergencyContacts)
      .where(eq(emergencyContacts.userId, userId));
  }

  async createEmergencyContact(contact: InsertEmergencyContact): Promise<EmergencyContact> {
    const db = await getDb();
    const [newContact] = await db
      .insert(emergencyContacts)
      .values({ ...contact, id: randomUUID() })
      .returning();
    return newContact;
  }

  async deleteEmergencyContact(id: string, userId: string): Promise<void> {
    const db = await getDb();
    await db
      .delete(emergencyContacts)
      .where(and(eq(emergencyContacts.id, id), eq(emergencyContacts.userId, userId)));
  }

  // Crime Reports operations
  async getCrimeReports(): Promise<CrimeReport[]> {
    const db = await getDb();
    return await db
      .select()
      .from(crimeReports)
      .orderBy(desc(crimeReports.reportedAt))
      .limit(100);
  }

  async getRecentCrimeReports(limit: number = 20): Promise<CrimeReport[]> {
    const db = await getDb();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return await db
      .select()
      .from(crimeReports)
      .where(sql`${crimeReports.reportedAt} >= ${sevenDaysAgo}`)
      .orderBy(desc(crimeReports.reportedAt))
      .limit(limit);
  }

  async getUserCrimeReports(userId: string): Promise<CrimeReport[]> {
    const db = await getDb();
    return await db
      .select()
      .from(crimeReports)
      .where(eq(crimeReports.userId, userId))
      .orderBy(desc(crimeReports.reportedAt));
  }

  async createCrimeReport(report: InsertCrimeReport): Promise<CrimeReport> {
    const db = await getDb();
    const [newReport] = await db
      .insert(crimeReports)
      .values({ ...report, id: randomUUID() })
      .returning();
    return newReport;
  }

  // SOS Alerts operations
  async createSosAlert(alert: InsertSosAlert): Promise<SosAlert> {
    const db = await getDb();
    const [newAlert] = await db
      .insert(sosAlerts)
      .values({ ...alert, id: randomUUID() })
      .returning();
    return newAlert;
  }

  async getUserSosAlerts(userId: string): Promise<SosAlert[]> {
    const db = await getDb();
    return await db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.userId, userId))
      .orderBy(desc(sosAlerts.createdAt))
      .limit(50);
  }
}

export const storage = new DatabaseStorage();
