import { pgTable, text, serial, timestamp, integer, date, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const officeLocationsTable = pgTable("office_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radius: integer("radius").notNull().default(50),
  requireApproval: boolean("require_approval").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("Absent"),
  checkInTime: timestamp("check_in_time", { withTimezone: true }),
  checkOutTime: timestamp("check_out_time", { withTimezone: true }),
  checkInLat: real("check_in_lat"),
  checkInLng: real("check_in_lng"),
  checkInSelfie: text("check_in_selfie"),
  workingHours: real("working_hours"),
  distanceTravelled: real("distance_travelled"),
  approvalStatus: text("approval_status"),
  approvedBy: integer("approved_by"),
  remarks: text("remarks"),
  eodSubmitted: boolean("eod_submitted").notNull().default(false),
  eodVisits: integer("eod_visits"),
  eodKm: real("eod_km"),
  eodLeads: integer("eod_leads"),
  eodOrders: integer("eod_orders"),
  eodCollection: real("eod_collection"),
  eodRemarks: text("eod_remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locationTracksTable = pgTable("location_tracks", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  speed: real("speed"),
  accuracy: real("accuracy"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;

export const insertOfficeLocationSchema = createInsertSchema(officeLocationsTable).omit({ id: true, createdAt: true });
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;
export type OfficeLocation = typeof officeLocationsTable.$inferSelect;

export const insertLocationTrackSchema = createInsertSchema(locationTracksTable).omit({ id: true, timestamp: true });
export type InsertLocationTrack = z.infer<typeof insertLocationTrackSchema>;
export type LocationTrack = typeof locationTracksTable.$inferSelect;
