import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  headId: integer("head_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const designationsTable = pgTable("designations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  departmentId: integer("department_id"),
  level: integer("level"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("Desk Employee"),
  status: text("status").notNull().default("active"),
  joiningDate: date("joining_date", { mode: "string" }).notNull(),
  departmentId: integer("department_id"),
  designationId: integer("designation_id"),
  managerId: integer("manager_id"),
  bankAccount: text("bank_account"),
  ifscCode: text("ifsc_code"),
  bankName: text("bank_name"),
  panNumber: text("pan_number"),
  aadharNumber: text("aadhar_number"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  profilePhoto: text("profile_photo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;

export const insertDesignationSchema = createInsertSchema(designationsTable).omit({ id: true, createdAt: true });
export type InsertDesignation = z.infer<typeof insertDesignationSchema>;
export type Designation = typeof designationsTable.$inferSelect;

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
