import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, departmentsTable, designationsTable, employeesTable } from "@workspace/db";
import {
  CreateDepartmentBody,
  UpdateDepartmentParams,
  UpdateDepartmentBody,
  DeleteDepartmentParams,
  CreateDesignationBody,
  UpdateDesignationParams,
  UpdateDesignationBody,
  DeleteDesignationParams,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

// ── Departments ──────────────────────────────────────
router.get("/departments", protect, async (_req, res): Promise<void> => {
  const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  const counts = await db
    .select({ departmentId: employeesTable.departmentId, count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .groupBy(employeesTable.departmentId);

  const countMap = new Map(counts.map((c) => [c.departmentId, c.count]));

  res.json(
    depts.map((d) => ({
      ...d,
      headName: null,
      employeeCount: countMap.get(d.id) ?? 0,
      createdAt: d.createdAt.toISOString(),
    }))
  );
});

router.post("/departments", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [dept] = await db.insert(departmentsTable).values(parsed.data).returning();
  res.status(201).json({ ...dept, headName: null, employeeCount: 0, createdAt: dept.createdAt.toISOString() });
});

router.patch("/departments/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const params = UpdateDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDepartmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [dept] = await db.update(departmentsTable).set(parsed.data).where(eq(departmentsTable.id, params.data.id)).returning();
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json({ ...dept, headName: null, employeeCount: 0, createdAt: dept.createdAt.toISOString() });
});

router.delete("/departments/:id", protect, authorize("SUPER_ADMIN", "ADMIN"), async (req, res): Promise<void> => {
  const params = DeleteDepartmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [dept] = await db.delete(departmentsTable).where(eq(departmentsTable.id, params.data.id)).returning();
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.sendStatus(204);
});

// ── Designations ──────────────────────────────────────
router.get("/designations", protect, async (_req, res): Promise<void> => {
  const desigs = await db
    .select({
      id: designationsTable.id,
      name: designationsTable.name,
      departmentId: designationsTable.departmentId,
      departmentName: departmentsTable.name,
      level: designationsTable.level,
      createdAt: designationsTable.createdAt,
    })
    .from(designationsTable)
    .leftJoin(departmentsTable, eq(designationsTable.departmentId, departmentsTable.id))
    .orderBy(designationsTable.name);
  res.json(desigs.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() })));
});

router.post("/designations", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateDesignationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [desig] = await db.insert(designationsTable).values(parsed.data).returning();
  res.status(201).json({ ...desig, departmentName: null, createdAt: desig.createdAt.toISOString() });
});

router.patch("/designations/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const params = UpdateDesignationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDesignationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [desig] = await db.update(designationsTable).set(parsed.data).where(eq(designationsTable.id, params.data.id)).returning();
  if (!desig) {
    res.status(404).json({ error: "Designation not found" });
    return;
  }
  res.json({ ...desig, departmentName: null, createdAt: desig.createdAt.toISOString() });
});

router.delete("/designations/:id", protect, authorize("SUPER_ADMIN", "ADMIN"), async (req, res): Promise<void> => {
  const params = DeleteDesignationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [desig] = await db.delete(designationsTable).where(eq(designationsTable.id, params.data.id)).returning();
  if (!desig) {
    res.status(404).json({ error: "Designation not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
