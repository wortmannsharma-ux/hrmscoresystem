import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, expensesTable, employeesTable } from "@workspace/db";
import {
  ListExpensesQueryParams,
  CreateExpenseBody,
  GetExpenseParams,
  ApproveExpenseParams,
  ApproveExpenseBody,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

function fmtExpense(e: typeof expensesTable.$inferSelect & { employeeName?: string | null }) {
  return { ...e, employeeName: e.employeeName ?? null, createdAt: e.createdAt.toISOString() };
}

router.get("/expenses", protect, async (req, res): Promise<void> => {
  const query = ListExpensesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { employeeId, status, month } = query.data;

  const rows = await db.select({
    id: expensesTable.id,
    employeeId: expensesTable.employeeId,
    employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
    category: expensesTable.category,
    amount: expensesTable.amount,
    date: expensesTable.date,
    description: expensesTable.description,
    billPhoto: expensesTable.billPhoto,
    status: expensesTable.status,
    managerApproval: expensesTable.managerApproval,
    accountsApproval: expensesTable.accountsApproval,
    isAutoTravel: expensesTable.isAutoTravel,
    travelKm: expensesTable.travelKm,
    travelRate: expensesTable.travelRate,
    approvedBy: expensesTable.approvedBy,
    rejectionReason: expensesTable.rejectionReason,
    createdAt: expensesTable.createdAt,
  })
    .from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .where(
      and(
        employeeId != null ? eq(expensesTable.employeeId, employeeId) : undefined,
        status != null ? eq(expensesTable.status, status) : undefined,
        month != null ? sql`to_char(${expensesTable.date}::date, 'YYYY-MM') = ${month}` : undefined
      )
    )
    .orderBy(expensesTable.createdAt);

  res.json(rows.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })));
});

router.post("/expenses", protect, async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let amount = parsed.data.amount;
  // Auto-calculate travel if needed
  if (parsed.data.isAutoTravel && parsed.data.travelKm && parsed.data.travelRate) {
    amount = parsed.data.travelKm * parsed.data.travelRate;
  }

  const [expense] = await db.insert(expensesTable).values({
    employeeId: parsed.data.employeeId,
    category: parsed.data.category,
    amount,
    date: parsed.data.date,
    description: parsed.data.description ?? undefined,
    billPhoto: parsed.data.billPhoto ?? undefined,
    isAutoTravel: parsed.data.isAutoTravel ?? false,
    travelKm: parsed.data.travelKm ?? undefined,
    travelRate: parsed.data.travelRate ?? undefined,
  }).returning();

  res.status(201).json(fmtExpense({ ...expense, employeeName: null }));
});

router.get("/expenses/:id", protect, async (req, res): Promise<void> => {
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, params.data.id));
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(fmtExpense({ ...expense, employeeName: null }));
});

router.patch("/expenses/:id/approve", protect, authorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER"), async (req, res): Promise<void> => {
  const params = ApproveExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ApproveExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const newStatus = parsed.data.action === "approve" ? "Manager Approved" : parsed.data.action === "accounts_approve" ? "Accounts Approved" : parsed.data.action === "reject" ? "Rejected" : parsed.data.action;

  const [expense] = await db.update(expensesTable).set({
    status: newStatus,
    managerApproval: parsed.data.action,
    approvedBy: parsed.data.approvedBy ?? undefined,
    rejectionReason: parsed.data.remarks ?? undefined,
  }).where(eq(expensesTable.id, params.data.id)).returning();

  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(fmtExpense({ ...expense, employeeName: null }));
});

export default router;
