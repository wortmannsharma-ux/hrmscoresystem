import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, employeesTable, departmentsTable, designationsTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
} from "@workspace/api-zod";
import { protect, authorize, ownerOrAuthorize } from "../middlewares/auth.js";
import { generateEmployeeId } from "../lib/employee-id.js";

const router: IRouter = Router();

// ── GET /employees ────────────────────────────────────────────────────────────
router.get(
  "/employees",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER"),
  async (req, res): Promise<void> => {
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
        address: employeesTable.address,
        profilePhoto: employeesTable.profilePhoto,
        createdAt: employeesTable.createdAt,
        bankAccount: employeesTable.bankAccount,
        ifscCode: employeesTable.ifscCode,
        bankName: employeesTable.bankName,
        panNumber: employeesTable.panNumber,
        aadharNumber: employeesTable.aadharNumber,
        emergencyContact: employeesTable.emergencyContact,
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

    const userRole = req.user!.role;
    const canSeeSensitive = ["SUPER_ADMIN", "ADMIN", "HR"].includes(userRole);

    const result = employees.map((e) => ({
      ...e,
      managerName: null,
      createdAt: e.createdAt.toISOString(),
      bankAccount: canSeeSensitive ? e.bankAccount : undefined,
      ifscCode: canSeeSensitive ? e.ifscCode : undefined,
      bankName: canSeeSensitive ? e.bankName : undefined,
      panNumber: canSeeSensitive ? e.panNumber : undefined,
      aadharNumber: canSeeSensitive ? e.aadharNumber : undefined,
      emergencyContact: canSeeSensitive ? e.emergencyContact : undefined,
    }));

    res.json(result);
  }
);

// ── POST /employees ───────────────────────────────────────────────────────────
router.post(
  "/employees",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
    const parsed = CreateEmployeeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    let deptName: string | null = null;
    if (parsed.data.departmentId) {
      const [dept] = await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, parsed.data.departmentId));
      deptName = dept?.name ?? null;
    }

    const employeeId = await generateEmployeeId(parsed.data.role ?? "Desk Employee", deptName);

    const [emp] = await db
      .insert(employeesTable)
      .values({ ...parsed.data, employeeId })
      .returning();

    res.status(201).json({
      ...emp,
      departmentName: null,
      designationName: null,
      managerName: null,
      createdAt: emp.createdAt.toISOString(),
    });
  }
);

// ── GET /employees/:id ────────────────────────────────────────────────────────
router.get(
  "/employees/:id",
  protect,
  ownerOrAuthorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER"),
  async (req, res): Promise<void> => {
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

    const userRole = req.user!.role;
    const canSeeSensitive =
      ["SUPER_ADMIN", "ADMIN", "HR"].includes(userRole) ||
      req.user!.employeeId === emp.id;

    res.json({
      ...emp,
      managerName: null,
      createdAt: emp.createdAt.toISOString(),
      bankAccount: canSeeSensitive ? emp.bankAccount : undefined,
      ifscCode: canSeeSensitive ? emp.ifscCode : undefined,
      bankName: canSeeSensitive ? emp.bankName : undefined,
      panNumber: canSeeSensitive ? emp.panNumber : undefined,
      aadharNumber: canSeeSensitive ? emp.aadharNumber : undefined,
      emergencyContact: canSeeSensitive ? emp.emergencyContact : undefined,
    });
  }
);

// ── PATCH /employees/:id ──────────────────────────────────────────────────────
router.patch(
  "/employees/:id",
  protect,
  ownerOrAuthorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
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

    const userRole = req.user!.role;
    const isAdmin = ["SUPER_ADMIN", "ADMIN", "HR"].includes(userRole);

    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      if (!isAdmin && ["role", "status", "employeeId", "departmentId", "designationId", "managerId"].includes(k)) {
        continue;
      }
      updateData[k] = v;
    }

    const [emp] = await db
      .update(employeesTable)
      .set(updateData)
      .where(eq(employeesTable.id, params.data.id))
      .returning();

    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.json({
      ...emp,
      departmentName: null,
      designationName: null,
      managerName: null,
      createdAt: emp.createdAt.toISOString(),
    });
  }
);

// ── DELETE /employees/:id ─────────────────────────────────────────────────────
router.delete(
  "/employees/:id",
  protect,
  authorize("SUPER_ADMIN"),
  async (req, res): Promise<void> => {
    const params = DeleteEmployeeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [emp] = await db
      .delete(employeesTable)
      .where(eq(employeesTable.id, params.data.id))
      .returning();

    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }
    res.sendStatus(204);
  }
);

export default router;
