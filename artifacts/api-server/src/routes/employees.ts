import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, employeesTable, departmentsTable, designationsTable, usersTable } from "@workspace/db";
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
  authorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER", "EMPLOYEE", "INTERN"),
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

    // Resolve manager names in a separate query
    const managerIds = [...new Set(employees.map((e) => e.managerId).filter((id): id is number => id != null))];
    const managerMap = new Map<number, string>();
    if (managerIds.length > 0) {
      const managers = await db
        .select({ id: employeesTable.id, firstName: employeesTable.firstName, lastName: employeesTable.lastName })
        .from(employeesTable)
        .where(sql`${employeesTable.id} = ANY(${sql`ARRAY[${sql.join(managerIds.map((id) => sql`${id}`), sql`, `)}]::int[]`})`);
      for (const m of managers) {
        managerMap.set(m.id, `${m.firstName} ${m.lastName}`);
      }
    }

    const userRole = req.user!.role;
    const canSeeSensitive = ["SUPER_ADMIN", "ADMIN", "HR"].includes(userRole);

    const result = employees.map((e) => ({
      ...e,
      managerName: e.managerId ? (managerMap.get(e.managerId) ?? null) : null,
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

    // If a user with the same email exists and is not yet linked, auto-link them
    const emailLower = parsed.data.email.toLowerCase();
    const userRows = await db
      .select({ id: usersTable.id, employeeId: usersTable.employeeId })
      .from(usersTable)
      .where(eq(usersTable.email, emailLower));

    if (userRows.length > 0 && !userRows[0]!.employeeId) {
      await db
        .update(usersTable)
        .set({ employeeId: emp.id })
        .where(eq(usersTable.id, userRows[0]!.id));
    }

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
  ownerOrAuthorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER", "EMPLOYEE", "INTERN"),
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

    // Resolve manager name
    let managerName: string | null = null;
    if (emp.managerId) {
      const [mgr] = await db
        .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
        .from(employeesTable)
        .where(eq(employeesTable.id, emp.managerId));
      if (mgr) managerName = `${mgr.firstName} ${mgr.lastName}`;
    }

    const userRole = req.user!.role;
    const canSeeSensitive =
      ["SUPER_ADMIN", "ADMIN", "HR"].includes(userRole) ||
      req.user!.employeeId === emp.id;

    res.json({
      ...emp,
      managerName,
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
  ownerOrAuthorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER", "TEAM_LEADER", "EMPLOYEE", "INTERN"),
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

    // Fields that only admins/HR can change
    const adminOnlyFields = ["role", "status", "employeeId", "departmentId", "designationId", "managerId"];

    const updateData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v === undefined) continue;
      if (!isAdmin && adminOnlyFields.includes(k)) {
        // Employees can't change admin-only fields
        continue;
      }
      updateData[k] = v;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
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

    // ── Sync employee status → user is_active ────────────────────────────────
    // When admin sets employee to inactive/active, the linked user login
    // account must be deactivated/activated too so they can't log in.
    if (updateData.status !== undefined) {
      const newIsActive = String(updateData.status).toLowerCase() === "active";
      await db
        .update(usersTable)
        .set({ isActive: newIsActive })
        .where(eq(usersTable.employeeId, params.data.id));
    }

    // Resolve manager name
    let managerName: string | null = null;
    if (emp.managerId) {
      const [mgr] = await db
        .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
        .from(employeesTable)
        .where(eq(employeesTable.id, emp.managerId));
      if (mgr) managerName = `${mgr.firstName} ${mgr.lastName}`;
    }

    res.json({
      ...emp,
      departmentName: null,
      designationName: null,
      managerName,
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
