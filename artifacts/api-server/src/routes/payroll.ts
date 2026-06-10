import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, payrollTable, salaryStructuresTable, attendanceTable, employeesTable } from "@workspace/db";
import {
  ListPayrollQueryParams,
  GeneratePayrollBody,
  GetPayrollRecordParams,
  CreateSalaryStructureBody,
  UpdateSalaryStructureParams,
  UpdateSalaryStructureBody,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

function fmtPayroll(p: typeof payrollTable.$inferSelect & { employeeName?: string | null }) {
  return { ...p, employeeName: p.employeeName ?? null, createdAt: p.createdAt.toISOString() };
}

router.get("/payroll", protect, async (req, res): Promise<void> => {
  const query = ListPayrollQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { month, employeeId } = query.data;

  const rows = await db.select({
    id: payrollTable.id,
    employeeId: payrollTable.employeeId,
    employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
    month: payrollTable.month,
    presentDays: payrollTable.presentDays,
    halfDays: payrollTable.halfDays,
    lopDays: payrollTable.lopDays,
    basic: payrollTable.basic,
    hra: payrollTable.hra,
    specialAllowance: payrollTable.specialAllowance,
    conveyance: payrollTable.conveyance,
    bonus: payrollTable.bonus,
    incentives: payrollTable.incentives,
    grossSalary: payrollTable.grossSalary,
    pfDeduction: payrollTable.pfDeduction,
    esiDeduction: payrollTable.esiDeduction,
    tdsDeduction: payrollTable.tdsDeduction,
    professionalTax: payrollTable.professionalTax,
    totalDeductions: payrollTable.totalDeductions,
    netSalary: payrollTable.netSalary,
    status: payrollTable.status,
    paidOn: payrollTable.paidOn,
    createdAt: payrollTable.createdAt,
  })
    .from(payrollTable)
    .leftJoin(employeesTable, eq(payrollTable.employeeId, employeesTable.id))
    .where(
      and(
        month != null ? eq(payrollTable.month, month) : undefined,
        employeeId != null ? eq(payrollTable.employeeId, employeeId) : undefined
      )
    )
    .orderBy(payrollTable.month);

  res.json(rows.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

router.post("/payroll/generate", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = GeneratePayrollBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { month } = parsed.data;
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.status, "active"));
  const records = [];

  for (const emp of employees) {
    // Get salary structure
    const [structure] = await db.select().from(salaryStructuresTable)
      .where(eq(salaryStructuresTable.employeeId, emp.id))
      .orderBy(salaryStructuresTable.effectiveFrom);

    if (!structure) continue;

    // Get attendance for month
    const attRows = await db.select().from(attendanceTable)
      .where(and(
        eq(attendanceTable.employeeId, emp.id),
        sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`
      ));

    const presentDays = attRows.filter((a) => ["Present", "WFH", "Outdoor Duty"].includes(a.status)).length;
    const halfDays = attRows.filter((a) => a.status === "Half Day").length;
    const lopDays = attRows.filter((a) => a.status === "Absent").length;
    const workingDays = 26;

    const ratio = (presentDays + halfDays * 0.5) / workingDays;
    const basic = structure.basic * ratio;
    const hra = structure.hra * ratio;
    const specialAllowance = structure.specialAllowance * ratio;
    const conveyance = structure.conveyance * ratio;
    const bonus = 0;
    const incentives = 0;
    const grossSalary = basic + hra + specialAllowance + conveyance + bonus + incentives;

    const pfDeduction = Math.min(basic * 0.12, 1800);
    const esiDeduction = grossSalary <= 21000 ? grossSalary * 0.0075 : 0;
    const tdsDeduction = grossSalary > 50000 ? grossSalary * 0.1 : 0;
    const professionalTax = grossSalary > 10000 ? 200 : 0;
    const totalDeductions = pfDeduction + esiDeduction + tdsDeduction + professionalTax;
    const netSalary = grossSalary - totalDeductions;

    // Check if already exists
    const existing = await db.select().from(payrollTable)
      .where(and(eq(payrollTable.employeeId, emp.id), eq(payrollTable.month, month)));

    let record;
    if (existing.length > 0) {
      const [r] = await db.update(payrollTable).set({
        presentDays, halfDays, lopDays, basic, hra, specialAllowance, conveyance,
        bonus, incentives, grossSalary, pfDeduction, esiDeduction, tdsDeduction,
        professionalTax, totalDeductions, netSalary, status: "Draft",
      }).where(eq(payrollTable.id, existing[0].id)).returning();
      record = r;
    } else {
      const [r] = await db.insert(payrollTable).values({
        employeeId: emp.id, month, presentDays, halfDays, lopDays, basic, hra,
        specialAllowance, conveyance, bonus, incentives, grossSalary, pfDeduction,
        esiDeduction, tdsDeduction, professionalTax, totalDeductions, netSalary, status: "Draft",
      }).returning();
      record = r;
    }
    records.push(fmtPayroll({ ...record, employeeName: null }));
  }

  res.status(201).json(records);
});

router.get("/payroll/:id", protect, async (req, res): Promise<void> => {
  const params = GetPayrollRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [record] = await db.select().from(payrollTable).where(eq(payrollTable.id, params.data.id));
  if (!record) {
    res.status(404).json({ error: "Payroll record not found" });
    return;
  }
  res.json(fmtPayroll({ ...record, employeeName: null }));
});

// ── Salary Structures ──────────────────────────────────
router.get("/salary-structures", protect, async (_req, res): Promise<void> => {
  const rows = await db.select({
    id: salaryStructuresTable.id,
    employeeId: salaryStructuresTable.employeeId,
    employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
    effectiveFrom: salaryStructuresTable.effectiveFrom,
    basic: salaryStructuresTable.basic,
    hra: salaryStructuresTable.hra,
    specialAllowance: salaryStructuresTable.specialAllowance,
    conveyance: salaryStructuresTable.conveyance,
    createdAt: salaryStructuresTable.createdAt,
  })
    .from(salaryStructuresTable)
    .leftJoin(employeesTable, eq(salaryStructuresTable.employeeId, employeesTable.id))
    .orderBy(salaryStructuresTable.createdAt);

  res.json(rows.map((s) => ({
    ...s,
    ctc: s.basic + s.hra + s.specialAllowance + s.conveyance,
    employeeName: s.employeeName ?? null,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/salary-structures", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateSalaryStructureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [structure] = await db.insert(salaryStructuresTable).values({
    employeeId: parsed.data.employeeId,
    effectiveFrom: parsed.data.effectiveFrom,
    basic: parsed.data.basic,
    hra: parsed.data.hra ?? 0,
    specialAllowance: parsed.data.specialAllowance ?? 0,
    conveyance: parsed.data.conveyance ?? 0,
  }).returning();
  const ctc = structure.basic + structure.hra + structure.specialAllowance + structure.conveyance;
  res.status(201).json({ ...structure, ctc, employeeName: null, createdAt: structure.createdAt.toISOString() });
});

router.patch("/salary-structures/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const params = UpdateSalaryStructureParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSalaryStructureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [structure] = await db.update(salaryStructuresTable).set(updateData).where(eq(salaryStructuresTable.id, params.data.id)).returning();
  if (!structure) {
    res.status(404).json({ error: "Salary structure not found" });
    return;
  }
  const ctc = structure.basic + structure.hra + structure.specialAllowance + structure.conveyance;
  res.status(200).json({ ...structure, ctc, employeeName: null, createdAt: structure.createdAt.toISOString() });
});

export default router;
