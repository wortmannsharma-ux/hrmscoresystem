import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  mobile: text("mobile"),
  email: text("email"),
  address: text("address"),
  lat: real("lat"),
  lng: real("lng"),
  radius: integer("radius").default(50),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const visitsTable = pgTable("visits", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  visitDate: text("visit_date").notNull(),
  checkInTime: timestamp("check_in_time", { withTimezone: true }),
  selfieUrl: text("selfie_url"),
  lat: real("lat"),
  lng: real("lng"),
  remarks: text("remarks"),
  meetingNotes: text("meeting_notes"),
  orderValue: real("order_value"),
  nextFollowUp: text("next_follow_up"),
  status: text("status").notNull().default("Valid"),
  invalidReason: text("invalid_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;

export const insertVisitSchema = createInsertSchema(visitsTable).omit({ id: true, createdAt: true });
export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visitsTable.$inferSelect;
