import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  departmentId: integer("department_id").notNull(),
  description: text("description"),
  requirements: text("requirements"),
  location: text("location"),
  experienceMin: integer("experience_min"),
  experienceMax: integer("experience_max"),
  salaryMin: real("salary_min"),
  salaryMax: real("salary_max"),
  status: text("status").notNull().default("Open"),
  openings: integer("openings").notNull().default(1),
  postedDate: text("posted_date").notNull(),
  closingDate: text("closing_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const applicantsTable = pgTable("applicants", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  experience: real("experience"),
  currentCtc: real("current_ctc"),
  expectedCtc: real("expected_ctc"),
  noticePeriod: integer("notice_period"),
  resumeUrl: text("resume_url"),
  status: text("status").notNull().default("Applied"),
  source: text("source"),
  interviewDate: text("interview_date"),
  interviewNotes: text("interview_notes"),
  hrNotes: text("hr_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  isRead: text("is_read").notNull().default("false"),
  relatedId: integer("related_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

export const insertApplicantSchema = createInsertSchema(applicantsTable).omit({ id: true, createdAt: true });
export type InsertApplicant = z.infer<typeof insertApplicantSchema>;
export type Applicant = typeof applicantsTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
