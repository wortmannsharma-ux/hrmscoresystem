import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salaryStructuresTable = pgTable("salary_structures", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  basic: real("basic").notNull(),
  hra: real("hra").notNull().default(0),
  specialAllowance: real("special_allowance").notNull().default(0),
  conveyance: real("conveyance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payrollTable = pgTable("payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  month: text("month").notNull(),
  presentDays: real("present_days").notNull().default(0),
  halfDays: real("half_days").notNull().default(0),
  lopDays: real("lop_days").notNull().default(0),
  basic: real("basic").notNull().default(0),
  hra: real("hra").notNull().default(0),
  specialAllowance: real("special_allowance").notNull().default(0),
  conveyance: real("conveyance").notNull().default(0),
  bonus: real("bonus").notNull().default(0),
  incentives: real("incentives").notNull().default(0),
  grossSalary: real("gross_salary").notNull().default(0),
  pfDeduction: real("pf_deduction").notNull().default(0),
  esiDeduction: real("esi_deduction").notNull().default(0),
  tdsDeduction: real("tds_deduction").notNull().default(0),
  professionalTax: real("professional_tax").notNull().default(0),
  totalDeductions: real("total_deductions").notNull().default(0),
  netSalary: real("net_salary").notNull().default(0),
  status: text("status").notNull().default("Draft"),
  paidOn: text("paid_on"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalaryStructureSchema = createInsertSchema(salaryStructuresTable).omit({ id: true, createdAt: true });
export type InsertSalaryStructure = z.infer<typeof insertSalaryStructureSchema>;
export type SalaryStructure = typeof salaryStructuresTable.$inferSelect;

export const insertPayrollSchema = createInsertSchema(payrollTable).omit({ id: true, createdAt: true });
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type PayrollRecord = typeof payrollTable.$inferSelect;
