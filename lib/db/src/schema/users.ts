import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Roles exactly matching hrms-backend
export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
  "MANAGER",
  "TEAM_LEADER",
  "EMPLOYEE",
  "INTERN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),        // role-based ID e.g. SA1, HR2, MGR3
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),              // bcrypt hash — field named `password` matching hrms-backend
  role: text("role").notNull().default("EMPLOYEE"),  // SUPER_ADMIN | ADMIN | HR | MANAGER | TEAM_LEADER | EMPLOYEE | INTERN
  isActive: boolean("is_active").notNull().default(true),
  employeeId: integer("employee_id").unique(),       // link to employees table (optional)
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
