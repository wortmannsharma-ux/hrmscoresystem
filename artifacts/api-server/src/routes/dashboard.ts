import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, employeesTable, attendanceTable, leavesTable, expensesTable, jobsTable, applicantsTable, notificationsTable } from "@workspace/db";
import { protect } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/dashboard/hr-summary", protect, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const month = today.slice(0, 7);
  const currentYear = new Date().getFullYear();

  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(eq(employeesTable.status, "active"));
  const [allTotal] = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable);

  const todayAtt = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
  const pendingLeaves = await db.select({ count: sql<number>`count(*)::int` }).from(leavesTable).where(eq(leavesTable.status, "Pending"));
  const pendingExpenses = await db.select({ count: sql<number>`count(*)::int`, total: sql<number>`COALESCE(SUM(amount), 0)::float` }).from(expensesTable).where(eq(expensesTable.status, "Pending"));
  const openJobs = await db.select({ count: sql<number>`count(*)::int` }).from(jobsTable).where(eq(jobsTable.status, "Open"));

  // New joinees this month
  const newJoinees = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable)
    .where(sql`to_char(${employeesTable.joiningDate}::date, 'YYYY-MM') = ${month}`);

  // Department breakdown
  const deptBreakdown = await db.execute(sql`
    SELECT d.id as "departmentId", d.name as "departmentName", COUNT(e.id)::int as count
    FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'active'
    GROUP BY d.id, d.name
    ORDER BY count DESC
  `);

  // Attendance trend last 7 days
  const trend = await db.execute(sql`
    SELECT
      date,
      COUNT(CASE WHEN status IN ('Present','WFH','Outdoor Duty') THEN 1 END)::int as present,
      COUNT(CASE WHEN status = 'Absent' THEN 1 END)::int as absent,
      COUNT(CASE WHEN status = 'Late' THEN 1 END)::int as late
    FROM attendance
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY date
    ORDER BY date
  `);

  res.json({
    totalEmployees: allTotal?.count ?? 0,
    activeEmployees: total?.count ?? 0,
    presentToday: todayAtt.filter((a) => ["Present", "WFH", "Outdoor Duty", "Late"].includes(a.status)).length,
    absentToday: todayAtt.filter((a) => a.status === "Absent").length,
    onLeaveToday: todayAtt.filter((a) => a.status === "On Leave").length,
    lateToday: todayAtt.filter((a) => a.status === "Late").length,
    newJoinees: newJoinees[0]?.count ?? 0,
    exitingThisMonth: 0,
    openPositions: openJobs[0]?.count ?? 0,
    pendingLeaves: pendingLeaves[0]?.count ?? 0,
    pendingExpensesCount: pendingExpenses[0]?.count ?? 0,
    pendingExpenses: pendingExpenses[0]?.total ?? 0,
    payrollMonth: month,
    payrollProcessed: false,
    departmentBreakdown: deptBreakdown.rows as { departmentId: number; departmentName: string; count: number }[],
    attendanceTrend: (trend.rows as { date: string; present: number; absent: number; late: number }[]),
  });
});

router.get("/dashboard/manager-summary", protect, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const todayAtt = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));
  const [teamSize] = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(eq(employeesTable.status, "active"));
  const [pendingLeaves] = await db.select({ count: sql<number>`count(*)::int` }).from(leavesTable).where(eq(leavesTable.status, "Pending"));
  const [pendingExpenses] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable).where(eq(expensesTable.status, "Pending"));

  const fieldExecs = todayAtt.filter((a) => a.status === "Outdoor Duty" && !a.eodSubmitted).length;
  const totalKm = todayAtt.reduce((sum, a) => sum + (a.distanceTravelled ?? 0), 0);

  const todayVisits = await db.execute(sql`SELECT COUNT(*)::int as count FROM visits WHERE visit_date = ${today}`);

  res.json({
    teamSize: teamSize?.count ?? 0,
    presentToday: todayAtt.filter((a) => ["Present", "WFH", "Outdoor Duty", "Late"].includes(a.status)).length,
    absentToday: todayAtt.filter((a) => a.status === "Absent").length,
    onLeaveToday: todayAtt.filter((a) => a.status === "On Leave").length,
    lateToday: todayAtt.filter((a) => a.status === "Late").length,
    activeFieldExecs: fieldExecs,
    pendingApprovals: (pendingLeaves?.count ?? 0) + (pendingExpenses?.count ?? 0),
    pendingLeaves: pendingLeaves?.count ?? 0,
    pendingExpenses: pendingExpenses?.count ?? 0,
    todayVisits: (todayVisits.rows[0] as { count: number })?.count ?? 0,
    totalKmToday: Math.round(totalKm * 10) / 10,
  });
});

router.get("/dashboard/pending-approvals", protect, async (_req, res): Promise<void> => {
  const [leaves] = await db.select({ count: sql<number>`count(*)::int` }).from(leavesTable).where(eq(leavesTable.status, "Pending"));
  const [expenses] = await db.select({ count: sql<number>`count(*)::int` }).from(expensesTable).where(eq(expensesTable.status, "Pending"));
  const [attendance] = await db.select({ count: sql<number>`count(*)::int` }).from(attendanceTable).where(eq(attendanceTable.approvalStatus, "Pending"));

  const visits = await db.execute(sql`SELECT COUNT(*)::int as count FROM visits WHERE status = 'Invalid'`);

  const leavesCount = leaves?.count ?? 0;
  const expensesCount = expenses?.count ?? 0;
  const attendanceCount = attendance?.count ?? 0;
  const visitsCount = (visits.rows[0] as { count: number })?.count ?? 0;

  res.json({
    leaves: leavesCount,
    expenses: expensesCount,
    attendance: attendanceCount,
    visits: visitsCount,
    total: leavesCount + expensesCount + attendanceCount + visitsCount,
  });
});

router.get("/dashboard/recent-activity", protect, async (_req, res): Promise<void> => {
  // Combine recent leaves, expenses, visits into activity feed
  const recentLeaves = await db.select({
    id: leavesTable.id,
    employeeId: leavesTable.employeeId,
    firstName: employeesTable.firstName,
    lastName: employeesTable.lastName,
    status: leavesTable.status,
    createdAt: leavesTable.createdAt,
  }).from(leavesTable)
    .leftJoin(employeesTable, eq(leavesTable.employeeId, employeesTable.id))
    .orderBy(leavesTable.createdAt)
    .limit(5);

  const recentExpenses = await db.select({
    id: expensesTable.id,
    employeeId: expensesTable.employeeId,
    firstName: employeesTable.firstName,
    lastName: employeesTable.lastName,
    category: expensesTable.category,
    amount: expensesTable.amount,
    status: expensesTable.status,
    createdAt: expensesTable.createdAt,
  }).from(expensesTable)
    .leftJoin(employeesTable, eq(expensesTable.employeeId, employeesTable.id))
    .orderBy(expensesTable.createdAt)
    .limit(5);

  const activities = [
    ...recentLeaves.map((l, i) => ({
      id: i + 1,
      type: "leave",
      message: `${l.firstName} ${l.lastName} applied for leave (${l.status})`,
      employeeId: l.employeeId,
      employeeName: `${l.firstName} ${l.lastName}`,
      timestamp: l.createdAt.toISOString(),
    })),
    ...recentExpenses.map((e, i) => ({
      id: recentLeaves.length + i + 1,
      type: "expense",
      message: `${e.firstName} ${e.lastName} submitted ₹${e.amount} ${e.category} expense`,
      employeeId: e.employeeId,
      employeeName: `${e.firstName} ${e.lastName}`,
      timestamp: e.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  res.json(activities);
});

// ── Notifications ──────────────────────────────────────
router.get("/notifications", protect, async (req, res): Promise<void> => {
  const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
  const unreadOnly = req.query.unreadOnly === "true";

  const rows = await db.select().from(notificationsTable)
    .where(
      and(
        employeeId != null ? eq(notificationsTable.employeeId, employeeId) : undefined,
        unreadOnly ? eq(notificationsTable.isRead, "false") : undefined
      )
    )
    .orderBy(notificationsTable.createdAt)
    .limit(50);

  res.json(rows.map((n) => ({
    ...n,
    isRead: n.isRead === "true",
    createdAt: n.createdAt.toISOString(),
  })));
});

router.patch("/notifications/:id/read", protect, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [notif] = await db.update(notificationsTable).set({ isRead: "true" }).where(eq(notificationsTable.id, id)).returning();
  if (!notif) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json({ ...notif, isRead: notif.isRead === "true", createdAt: notif.createdAt.toISOString() });
});

export default router;
