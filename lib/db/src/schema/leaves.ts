import { pgTable, text, serial, timestamp, integer, date, real, boolean, unique } from "drizzle-orm/pg-core";
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

// ── Leave Balances ─────────────────────────────────────────────────────────────
// Stores the TOTAL entitlement per employee per year.
// Admin/HR can override these; the used amounts are always computed from leaves.
export const leaveBalancesTable = pgTable("leave_balances", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  year: integer("year").notNull(),
  casual: real("casual").notNull().default(12),
  sick: real("sick").notNull().default(12),
  earned: real("earned").notNull().default(15),
  unpaid: real("unpaid").notNull().default(999),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("leave_balances_emp_year").on(t.employeeId, t.year)]);

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalancesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveBalance = typeof leaveBalancesTable.$inferSelect;
