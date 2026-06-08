import { pgTable, text, serial, timestamp, integer, date, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  description: text("description"),
  billPhoto: text("bill_photo"),
  status: text("status").notNull().default("Pending"),
  managerApproval: text("manager_approval"),
  accountsApproval: text("accounts_approval"),
  isAutoTravel: boolean("is_auto_travel").notNull().default(false),
  travelKm: real("travel_km"),
  travelRate: real("travel_rate"),
  approvedBy: integer("approved_by"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
