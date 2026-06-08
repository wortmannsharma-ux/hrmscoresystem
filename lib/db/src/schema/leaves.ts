import { pgTable, text, serial, timestamp, integer, date, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leavesTable = pgTable("leaves", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  leaveType: text("leave_type").notNull(),
  fromDate: date("from_date", { mode: "string" }).notNull(),
  toDate: date("to_date", { mode: "string" }).notNull(),
  days: real("days").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("Pending"),
  managerApproval: text("manager_approval"),
  hrApproval: text("hr_approval"),
  approvedBy: integer("approved_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  type: text("type").notNull().default("National"),
  isOptional: boolean("is_optional").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLeaveSchema = createInsertSchema(leavesTable).omit({ id: true, createdAt: true });
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leavesTable.$inferSelect;

export const insertHolidaySchema = createInsertSchema(holidaysTable).omit({ id: true, createdAt: true });
export type InsertHoliday = z.infer<typeof insertHolidaySchema>;
export type Holiday = typeof holidaysTable.$inferSelect;
