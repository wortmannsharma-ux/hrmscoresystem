import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, leavesTable, employeesTable, holidaysTable } from "@workspace/db";
import {
  ListLeavesQueryParams,
  CreateLeaveBody,
  GetLeaveParams,
  ApproveLeaveParams,
  ApproveLeaveBody,
  GetLeaveBalanceParams,
  CreateHolidayBody,
  ListHolidaysQueryParams,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

function fmtLeave(l: typeof leavesTable.$inferSelect & { employeeName?: string | null; approverName?: string | null }) {
  return {
    ...l,
    employeeName: l.employeeName ?? null,
    approverName: l.approverName ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/leaves", protect, async (req, res): Promise<void> => {
  const query = ListLeavesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { employeeId, status, month } = query.data;

  const rows = await db.select({
    id: leavesTable.id,
    employeeId: leavesTable.employeeId,
    employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
    leaveType: leavesTable.leaveType,
    fromDate: leavesTable.fromDate,
    toDate: leavesTable.toDate,
    days: leavesTable.days,
    reason: leavesTable.reason,
    status: leavesTable.status,
    managerApproval: leavesTable.managerApproval,
    hrApproval: leavesTable.hrApproval,
    approvedBy: leavesTable.approvedBy,
    rejectionReason: leavesTable.rejectionReason,
    createdAt: leavesTable.createdAt,
  })
    .from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .where(
      and(
        employeeId != null ? eq(leavesTable.employeeId, employeeId) : undefined,
        status != null ? eq(leavesTable.status, status) : undefined,
        month != null ? sql`to_char(${leavesTable.fromDate}::date, 'YYYY-MM') = ${month}` : undefined
      )
    )
    .orderBy(leavesTable.createdAt);

  res.json(rows.map((l) => ({ ...l, approverName: null, createdAt: l.createdAt.toISOString() })));
});

router.post("/leaves", protect, async (req, res): Promise<void> => {
  const parsed = CreateLeaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const from = new Date(parsed.data.fromDate);
  const to = new Date(parsed.data.toDate);
  const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const [leave] = await db.insert(leavesTable).values({ ...parsed.data, days }).returning();
  res.status(201).json(fmtLeave({ ...leave, employeeName: null, approverName: null }));
});

router.get("/leaves/:id", protect, async (req, res): Promise<void> => {
  const params = GetLeaveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [leave] = await db.select().from(leavesTable).where(eq(leavesTable.id, params.data.id));
  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(fmtLeave({ ...leave, employeeName: null, approverName: null }));
});

router.patch("/leaves/:id/approve", protect, authorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER"), async (req, res): Promise<void> => {
  const params = ApproveLeaveParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ApproveLeaveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const newStatus = parsed.data.action === "approve" ? "Approved" : parsed.data.action === "reject" ? "Rejected" : parsed.data.action;

  const [leave] = await db.update(leavesTable).set({
    status: newStatus,
    managerApproval: parsed.data.action,
    hrApproval: parsed.data.action,
    approvedBy: parsed.data.approvedBy ?? undefined,
    rejectionReason: parsed.data.remarks ?? undefined,
  }).where(eq(leavesTable.id, params.data.id)).returning();

  if (!leave) {
    res.status(404).json({ error: "Leave not found" });
    return;
  }
  res.json(fmtLeave({ ...leave, employeeName: null, approverName: null }));
});

router.get("/leaves/balance/:employeeId", protect, async (req, res): Promise<void> => {
  const params = GetLeaveBalanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const year = new Date().getFullYear().toString();
  const leaves = await db.select().from(leavesTable).where(
    and(
      eq(leavesTable.employeeId, params.data.employeeId),
      eq(leavesTable.status, "Approved"),
      sql`extract(year from ${leavesTable.fromDate}::date) = ${year}`
    )
  );

  const used = (type: string) => leaves.filter((l) => l.leaveType === type).reduce((sum, l) => sum + (l.days ?? 0), 0);

  res.json({
    employeeId: params.data.employeeId,
    casual: 12, sick: 12, earned: 15, unpaid: 999,
    casualUsed: used("Casual"),
    sickUsed: used("Sick"),
    earnedUsed: used("Earned"),
    unpaidUsed: used("Unpaid"),
  });
});

// ── Holidays ──────────────────────────────────────────
router.get("/holidays", protect, async (req, res): Promise<void> => {
  const query = ListHolidaysQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { year } = query.data;

  const rows = await db.select().from(holidaysTable).where(
    year != null ? sql`extract(year from ${holidaysTable.date}::date) = ${year}` : undefined
  ).orderBy(holidaysTable.date);

  res.json(rows.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() })));
});

router.post("/holidays", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateHolidayBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [holiday] = await db.insert(holidaysTable).values({
    name: parsed.data.name,
    date: parsed.data.date,
    type: parsed.data.type,
    isOptional: parsed.data.isOptional ?? false,
  }).returning();
  res.status(201).json({ ...holiday, createdAt: holiday.createdAt.toISOString() });
});

router.delete("/holidays/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [h] = await db.delete(holidaysTable).where(eq(holidaysTable.id, id)).returning();
  if (!h) {
    res.status(404).json({ error: "Holiday not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
