import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, jobsTable, applicantsTable, departmentsTable } from "@workspace/db";
import {
  ListJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  ListApplicantsQueryParams,
  CreateApplicantBody,
  GetApplicantParams,
  UpdateApplicantParams,
  UpdateApplicantBody,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

// ── Jobs ──────────────────────────────────────────────
router.get("/jobs", protect, async (req, res): Promise<void> => {
  const query = ListJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select({
    id: jobsTable.id,
    title: jobsTable.title,
    departmentId: jobsTable.departmentId,
    departmentName: departmentsTable.name,
    description: jobsTable.description,
    requirements: jobsTable.requirements,
    location: jobsTable.location,
    experienceMin: jobsTable.experienceMin,
    experienceMax: jobsTable.experienceMax,
    salaryMin: jobsTable.salaryMin,
    salaryMax: jobsTable.salaryMax,
    status: jobsTable.status,
    openings: jobsTable.openings,
    postedDate: jobsTable.postedDate,
    closingDate: jobsTable.closingDate,
    createdAt: jobsTable.createdAt,
  })
    .from(jobsTable)
    .leftJoin(departmentsTable, eq(jobsTable.departmentId, departmentsTable.id))
    .where(query.data.status != null ? eq(jobsTable.status, query.data.status) : undefined)
    .orderBy(jobsTable.createdAt);

  const counts = await db.select({
    jobId: applicantsTable.jobId,
    count: sql<number>`count(*)::int`,
  }).from(applicantsTable).groupBy(applicantsTable.jobId);
  const countMap = new Map(counts.map((c) => [c.jobId, c.count]));

  res.json(rows.map((j) => ({
    ...j,
    applicantCount: countMap.get(j.id) ?? 0,
    createdAt: j.createdAt.toISOString(),
  })));
});

router.post("/jobs", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const today = new Date().toISOString().split("T")[0];
  const [job] = await db.insert(jobsTable).values({
    title: parsed.data.title,
    departmentId: parsed.data.departmentId,
    description: parsed.data.description ?? undefined,
    requirements: parsed.data.requirements ?? undefined,
    location: parsed.data.location ?? undefined,
    experienceMin: parsed.data.experienceMin ?? undefined,
    experienceMax: parsed.data.experienceMax ?? undefined,
    salaryMin: parsed.data.salaryMin ?? undefined,
    salaryMax: parsed.data.salaryMax ?? undefined,
    openings: parsed.data.openings,
    postedDate: today,
    closingDate: parsed.data.closingDate ?? undefined,
  }).returning();
  res.status(201).json({ ...job, departmentName: null, applicantCount: 0, createdAt: job.createdAt.toISOString() });
});

router.get("/jobs/:id", protect, async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ ...job, departmentName: null, applicantCount: 0, createdAt: job.createdAt.toISOString() });
});

router.patch("/jobs/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [job] = await db.update(jobsTable).set(updateData).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ ...job, departmentName: null, applicantCount: 0, createdAt: job.createdAt.toISOString() });
});

// ── Applicants ────────────────────────────────────────
router.get("/applicants", protect, async (req, res): Promise<void> => {
  const query = ListApplicantsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { jobId, status, search } = query.data;

  const rows = await db.select({
    id: applicantsTable.id,
    jobId: applicantsTable.jobId,
    jobTitle: jobsTable.title,
    name: applicantsTable.name,
    email: applicantsTable.email,
    phone: applicantsTable.phone,
    experience: applicantsTable.experience,
    currentCtc: applicantsTable.currentCtc,
    expectedCtc: applicantsTable.expectedCtc,
    noticePeriod: applicantsTable.noticePeriod,
    resumeUrl: applicantsTable.resumeUrl,
    status: applicantsTable.status,
    source: applicantsTable.source,
    interviewDate: applicantsTable.interviewDate,
    interviewNotes: applicantsTable.interviewNotes,
    hrNotes: applicantsTable.hrNotes,
    createdAt: applicantsTable.createdAt,
  })
    .from(applicantsTable)
    .leftJoin(jobsTable, eq(applicantsTable.jobId, jobsTable.id))
    .where(
      and(
        jobId != null ? eq(applicantsTable.jobId, jobId) : undefined,
        status != null ? eq(applicantsTable.status, status) : undefined,
        search != null ? ilike(applicantsTable.name, `%${search}%`) : undefined
      )
    )
    .orderBy(applicantsTable.createdAt);

  res.json(rows.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })));
});

router.post("/applicants", protect, async (req, res): Promise<void> => {
  const parsed = CreateApplicantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [applicant] = await db.insert(applicantsTable).values({
    jobId: parsed.data.jobId,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    experience: parsed.data.experience ?? undefined,
    currentCtc: parsed.data.currentCtc ?? undefined,
    expectedCtc: parsed.data.expectedCtc ?? undefined,
    noticePeriod: parsed.data.noticePeriod ?? undefined,
    resumeUrl: parsed.data.resumeUrl ?? undefined,
    source: parsed.data.source ?? undefined,
  }).returning();
  res.status(201).json({ ...applicant, jobTitle: null, createdAt: applicant.createdAt.toISOString() });
});

router.get("/applicants/:id", protect, async (req, res): Promise<void> => {
  const params = GetApplicantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [applicant] = await db.select().from(applicantsTable).where(eq(applicantsTable.id, params.data.id));
  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }
  res.json({ ...applicant, jobTitle: null, createdAt: applicant.createdAt.toISOString() });
});

router.patch("/applicants/:id", protect, async (req, res): Promise<void> => {
  const params = UpdateApplicantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateApplicantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [applicant] = await db.update(applicantsTable).set(updateData).where(eq(applicantsTable.id, params.data.id)).returning();
  if (!applicant) {
    res.status(404).json({ error: "Applicant not found" });
    return;
  }
  res.json({ ...applicant, jobTitle: null, createdAt: applicant.createdAt.toISOString() });
});

export default router;
