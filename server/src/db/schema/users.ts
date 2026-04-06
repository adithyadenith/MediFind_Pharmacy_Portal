import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmacyApprovalStatuses = ["pending", "approved", "rejected"] as const;
export type PharmacyApprovalStatus = (typeof pharmacyApprovalStatuses)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  pharmacyName: text("pharmacy_name"),
  address: text("address"),
  contactNumber: text("contact_number"),
  databaseUrl: text("database_url"),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").notNull().default(false),
  status: text("status").notNull().default("pending"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  code: text("code").notNull(),
  purpose: text("purpose").notNull().default("login"),
  pharmacyName: text("pharmacy_name"),
  address: text("address"),
  contactNumber: text("contact_number"),
  databaseUrl: text("database_url"),
  pendingPasswordHash: text("pending_password_hash"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
export type OtpCode = typeof otpCodesTable.$inferSelect;
