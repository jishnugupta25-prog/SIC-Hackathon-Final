// Crime Report Portal - Database Storage Implementation
// From javascript_database and javascript_log_in_with_replit blueprints

import { randomUUID } from "node:crypto";
import {
  users,
  emergencyContacts,
  crimeReports,
  sosAlerts,
  admins,
  crimeApprovals,
  adminFeedback,
  type User,
  type UpsertUser,
  type EmergencyContact,
  type InsertEmergencyContact,
  type CrimeReport,
  type InsertCrimeReport,
  type SosAlert,
  type InsertSosAlert,
  type Admin,
  type CrimeApproval,
  type AdminFeedback,
  type InsertAdminFeedback,
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

  // Admin operations
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  getAdminById(id: string): Promise<Admin | undefined>;
  getCrimesForReview(): Promise<(CrimeReport & { approval: CrimeApproval | null })[]>;
  approveCrime(crimeId: string, adminId: string): Promise<CrimeApproval>;
  rejectCrime(crimeId: string, adminId: string): Promise<CrimeApproval>;
  createAdminFeedback(feedback: InsertAdminFeedback): Promise<AdminFeedback>;
  getUserFeedback(userId: string): Promise<AdminFeedback[]>;
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
    const now = new Date();
    // For email-based signup, generate a new ID if not provided
    if (!userData.id) {
      const [user] = await db
        .insert(users)
        .values({ ...userData, id: randomUUID(), createdAt: now, updatedAt: now })
        .returning();
      return user;
    }

    const [user] = await db
      .insert(users)
      .values({ ...userData, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: now,
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
      .values({ ...contact, id: randomUUID(), createdAt: new Date() })
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
    const now = new Date();
    const [newReport] = await db
      .insert(crimeReports)
      .values({ ...report, id: randomUUID(), createdAt: now, reportedAt: now })
      .returning();
    return newReport;
  }

  // SOS Alerts operations
  async createSosAlert(alert: InsertSosAlert): Promise<SosAlert> {
    const db = await getDb();
    // Convert sentTo array to JSON string for database storage
    const sentToString = Array.isArray(alert.sentTo) ? JSON.stringify(alert.sentTo) : alert.sentTo;
    const [newAlert] = await db
      .insert(sosAlerts)
      .values({ ...alert, sentTo: sentToString, id: randomUUID(), createdAt: new Date() })
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

  // Admin operations
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const db = await getDb();
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin;
  }

  async getAdminById(id: string): Promise<Admin | undefined> {
    const db = await getDb();
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin;
  }

  async getCrimesForReview(): Promise<(CrimeReport & { approval: CrimeApproval | null; reporter?: User })[]> {
    const db = await getDb();
    // Get all crimes with their approval status and reporter info
    const crimes = await db
      .select({
        crime: crimeReports,
        approval: crimeApprovals,
        user: users,
      })
      .from(crimeReports)
      .leftJoin(crimeApprovals, eq(crimeReports.id, crimeApprovals.crimeId))
      .leftJoin(users, eq(crimeReports.userId, users.id))
      .orderBy(desc(crimeReports.createdAt));
    
    return crimes.map((row: any) => ({
      ...row.crime,
      approval: row.approval,
      reporter: row.user,
    })) as (CrimeReport & { approval: CrimeApproval | null; reporter?: User })[];
  }

  async approveCrime(crimeId: string, adminId: string): Promise<CrimeApproval> {
    const db = await getDb();
    const now = new Date();
    const [approval] = await db
      .insert(crimeApprovals)
      .values({
        id: randomUUID(),
        crimeId,
        adminId,
        status: "approved",
        reviewedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: crimeApprovals.crimeId,
        set: {
          status: "approved",
          adminId,
          reviewedAt: now,
        },
      })
      .returning();
    return approval;
  }

  async rejectCrime(crimeId: string, adminId: string): Promise<CrimeApproval> {
    const db = await getDb();
    const now = new Date();
    const [approval] = await db
      .insert(crimeApprovals)
      .values({
        id: randomUUID(),
        crimeId,
        adminId,
        status: "rejected",
        reviewedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: crimeApprovals.crimeId,
        set: {
          status: "rejected",
          adminId,
          reviewedAt: now,
        },
      })
      .returning();
    return approval;
  }

  async createAdminFeedback(feedback: InsertAdminFeedback): Promise<AdminFeedback> {
    const db = await getDb();
    const [newFeedback] = await db
      .insert(adminFeedback)
      .values({ ...feedback, id: randomUUID(), createdAt: new Date() })
      .returning();
    return newFeedback;
  }

  async getUserFeedback(userId: string): Promise<AdminFeedback[]> {
    const db = await getDb();
    return await db
      .select()
      .from(adminFeedback)
      .where(eq(adminFeedback.userId, userId))
      .orderBy(desc(adminFeedback.createdAt));
  }
}

export const storage = new DatabaseStorage();
