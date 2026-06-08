import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, employeesTable, departmentsTable, designationsTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateEmployeeId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `EMP${num}`;
}

router.get("/employees", async (req, res): Promise<void> => {
  const query = ListEmployeesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { departmentId, designationId, status, search } = query.data;

  const employees = await db
    .select({
      id: employeesTable.id,
      employeeId: employeesTable.employeeId,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      role: employeesTable.role,
      status: employeesTable.status,
      joiningDate: employeesTable.joiningDate,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
      designationId: employeesTable.designationId,
      designationName: designationsTable.name,
      managerId: employeesTable.managerId,
      bankAccount: employeesTable.bankAccount,
      ifscCode: employeesTable.ifscCode,
      bankName: employeesTable.bankName,
      panNumber: employeesTable.panNumber,
      aadharNumber: employeesTable.aadharNumber,
      address: employeesTable.address,
      emergencyContact: employeesTable.emergencyContact,
      profilePhoto: employeesTable.profilePhoto,
      createdAt: employeesTable.createdAt,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
    .where(
      and(
        departmentId != null ? eq(employeesTable.departmentId, departmentId) : undefined,
        designationId != null ? eq(employeesTable.designationId, designationId) : undefined,
        status != null ? eq(employeesTable.status, status) : undefined,
        search != null
          ? sql`(${employeesTable.firstName} || ' ' || ${employeesTable.lastName}) ILIKE ${"%" + search + "%"} OR ${employeesTable.email} ILIKE ${"%" + search + "%"} OR ${employeesTable.employeeId} ILIKE ${"%" + search + "%"}`
          : undefined
      )
    );

  const result = employees.map((e) => ({
    ...e,
    managerName: null,
    createdAt: e.createdAt.toISOString(),
  }));

  res.json(result);
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let employeeId = generateEmployeeId();
  // ensure uniqueness
  const existing = await db.select().from(employeesTable).where(eq(employeesTable.employeeId, employeeId));
  if (existing.length > 0) {
    employeeId = generateEmployeeId() + Math.floor(Math.random() * 99);
  }

  const [emp] = await db.insert(employeesTable).values({
    ...parsed.data,
    employeeId,
  }).returning();

  res.status(201).json({ ...emp, departmentName: null, designationName: null, managerName: null, createdAt: emp.createdAt.toISOString() });
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db
    .select({
      id: employeesTable.id,
      employeeId: employeesTable.employeeId,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      email: employeesTable.email,
      phone: employeesTable.phone,
      role: employeesTable.role,
      status: employeesTable.status,
      joiningDate: employeesTable.joiningDate,
      departmentId: employeesTable.departmentId,
      departmentName: departmentsTable.name,
      designationId: employeesTable.designationId,
      designationName: designationsTable.name,
      managerId: employeesTable.managerId,
      bankAccount: employeesTable.bankAccount,
      ifscCode: employeesTable.ifscCode,
      bankName: employeesTable.bankName,
      panNumber: employeesTable.panNumber,
      aadharNumber: employeesTable.aadharNumber,
      address: employeesTable.address,
      emergencyContact: employeesTable.emergencyContact,
      profilePhoto: employeesTable.profilePhoto,
      createdAt: employeesTable.createdAt,
    })
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
    .leftJoin(designationsTable, eq(employeesTable.designationId, designationsTable.id))
    .where(eq(employeesTable.id, params.data.id));

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json({ ...emp, managerName: null, createdAt: emp.createdAt.toISOString() });
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }

  const [emp] = await db.update(employeesTable).set(updateData).where(eq(employeesTable.id, params.data.id)).returning();
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json({ ...emp, departmentName: null, designationName: null, managerName: null, createdAt: emp.createdAt.toISOString() });
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [emp] = await db.delete(employeesTable).where(eq(employeesTable.id, params.data.id)).returning();
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
