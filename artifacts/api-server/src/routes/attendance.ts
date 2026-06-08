import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, attendanceTable, employeesTable, officeLocationsTable, locationTracksTable } from "@workspace/db";
import {
  ListAttendanceQueryParams,
  DayStartBody,
  DayEndBody,
  ApproveAttendanceParams,
  ApproveAttendanceBody,
  GetAttendanceSummaryQueryParams,
  ListOfficeLocationsResponse,
  CreateOfficeLocationBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function fmtAttendance(a: typeof attendanceTable.$inferSelect & { employeeName?: string | null }) {
  return {
    ...a,
    checkInTime: toIso(a.checkInTime ?? null),
    checkOutTime: toIso(a.checkOutTime ?? null),
    createdAt: a.createdAt.toISOString(),
    employeeName: a.employeeName ?? null,
  };
}

router.get("/attendance", async (req, res): Promise<void> => {
  const query = ListAttendanceQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { employeeId, date, month } = query.data;

  const rows = await db
    .select({
      id: attendanceTable.id,
      employeeId: attendanceTable.employeeId,
      employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
      date: attendanceTable.date,
      status: attendanceTable.status,
      checkInTime: attendanceTable.checkInTime,
      checkOutTime: attendanceTable.checkOutTime,
      checkInLat: attendanceTable.checkInLat,
      checkInLng: attendanceTable.checkInLng,
      checkInSelfie: attendanceTable.checkInSelfie,
      workingHours: attendanceTable.workingHours,
      distanceTravelled: attendanceTable.distanceTravelled,
      approvalStatus: attendanceTable.approvalStatus,
      approvedBy: attendanceTable.approvedBy,
      remarks: attendanceTable.remarks,
      eodSubmitted: attendanceTable.eodSubmitted,
      eodVisits: attendanceTable.eodVisits,
      eodKm: attendanceTable.eodKm,
      eodLeads: attendanceTable.eodLeads,
      eodOrders: attendanceTable.eodOrders,
      eodCollection: attendanceTable.eodCollection,
      eodRemarks: attendanceTable.eodRemarks,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .where(
      and(
        employeeId != null ? eq(attendanceTable.employeeId, employeeId) : undefined,
        date != null ? eq(attendanceTable.date, date) : undefined,
        month != null ? sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}` : undefined
      )
    )
    .orderBy(attendanceTable.date);

  res.json(rows.map(fmtAttendance));
});

router.post("/attendance/day-start", async (req, res): Promise<void> => {
  const parsed = DayStartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const hour = new Date().getHours();
  const minutes = new Date().getMinutes();
  const totalMins = hour * 60 + minutes;

  let status = "Present";
  if (totalMins > 11 * 60) status = "Half Day";
  else if (totalMins > 9 * 60 + 30) status = "Late";

  // upsert
  const existing = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, parsed.data.employeeId), eq(attendanceTable.date, today)));

  let record;
  if (existing.length > 0) {
    const [r] = await db.update(attendanceTable).set({
      checkInTime: new Date(),
      checkInLat: parsed.data.lat ?? undefined,
      checkInLng: parsed.data.lng ?? undefined,
      checkInSelfie: parsed.data.selfieUrl,
      status,
      remarks: parsed.data.remarks ?? undefined,
    }).where(eq(attendanceTable.id, existing[0].id)).returning();
    record = r;
  } else {
    const [r] = await db.insert(attendanceTable).values({
      employeeId: parsed.data.employeeId,
      date: today,
      status,
      checkInTime: new Date(),
      checkInLat: parsed.data.lat ?? undefined,
      checkInLng: parsed.data.lng ?? undefined,
      checkInSelfie: parsed.data.selfieUrl,
      remarks: parsed.data.remarks ?? undefined,
    }).returning();
    record = r;
  }

  res.status(201).json(fmtAttendance(record));
});

router.post("/attendance/day-end", async (req, res): Promise<void> => {
  const parsed = DayEndBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const existing = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.employeeId, parsed.data.employeeId), eq(attendanceTable.date, today)));

  if (existing.length === 0) {
    res.status(404).json({ error: "No attendance record found for today. Please start your day first." });
    return;
  }

  const checkIn = existing[0].checkInTime;
  const checkOut = new Date();
  const workingHours = checkIn ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) : 0;

  const [record] = await db.update(attendanceTable).set({
    checkOutTime: checkOut,
    workingHours: Math.round(workingHours * 10) / 10,
    eodSubmitted: true,
    eodVisits: parsed.data.eodVisits,
    eodKm: parsed.data.eodKm,
    eodLeads: parsed.data.eodLeads,
    eodOrders: parsed.data.eodOrders,
    eodCollection: parsed.data.eodCollection,
    eodRemarks: parsed.data.eodRemarks ?? undefined,
    distanceTravelled: parsed.data.eodKm,
  }).where(eq(attendanceTable.id, existing[0].id)).returning();

  res.json(fmtAttendance(record));
});

router.patch("/attendance/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveAttendanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ApproveAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db.update(attendanceTable).set({
    approvalStatus: parsed.data.action,
    approvedBy: parsed.data.approvedBy ?? undefined,
    remarks: parsed.data.remarks ?? undefined,
  }).where(eq(attendanceTable.id, params.data.id)).returning();

  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  res.json(fmtAttendance(record));
});

router.get("/attendance/summary", async (req, res): Promise<void> => {
  const query = GetAttendanceSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const month = query.data.month ?? new Date().toISOString().slice(0, 7);

  const rows = await db.select().from(attendanceTable)
    .where(
      and(
        sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`,
        query.data.employeeId != null ? eq(attendanceTable.employeeId, query.data.employeeId) : undefined
      )
    );

  const summary = {
    totalPresent: rows.filter((r) => r.status === "Present").length,
    totalAbsent: rows.filter((r) => r.status === "Absent").length,
    totalHalfDay: rows.filter((r) => r.status === "Half Day").length,
    totalLate: rows.filter((r) => r.status === "Late").length,
    totalLeave: rows.filter((r) => r.status === "On Leave").length,
    totalWfh: rows.filter((r) => r.status === "WFH").length,
    totalOutdoor: rows.filter((r) => r.status === "Outdoor Duty").length,
    attendanceRate: rows.length > 0 ? Math.round(rows.filter((r) => ["Present", "Late", "Half Day"].includes(r.status)).length / rows.length * 100) : 0,
    month,
  };

  res.json(summary);
});

router.get("/attendance/today", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const totalEmployees = await db.select({ count: sql<number>`count(*)::int` }).from(employeesTable).where(eq(employeesTable.status, "active"));
  const todayRows = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));

  const result = {
    date: today,
    presentCount: todayRows.filter((r) => r.status === "Present").length,
    absentCount: todayRows.filter((r) => r.status === "Absent").length,
    lateCount: todayRows.filter((r) => r.status === "Late").length,
    onLeaveCount: todayRows.filter((r) => r.status === "On Leave").length,
    fieldCount: todayRows.filter((r) => r.status === "Outdoor Duty").length,
    notCheckedIn: (totalEmployees[0]?.count ?? 0) - todayRows.length,
    activeFieldExecutives: todayRows.filter((r) => r.status === "Outdoor Duty" && !r.eodSubmitted).length,
  };

  res.json(result);
});

// ── Office Locations ──────────────────────────────────
router.get("/office-locations", async (_req, res): Promise<void> => {
  const locs = await db.select().from(officeLocationsTable).orderBy(officeLocationsTable.name);
  res.json(locs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

router.post("/office-locations", async (req, res): Promise<void> => {
  const parsed = CreateOfficeLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [loc] = await db.insert(officeLocationsTable).values({
    name: parsed.data.name,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radius: parsed.data.radius,
    requireApproval: parsed.data.requireApproval ?? false,
    isActive: parsed.data.isActive ?? true,
  }).returning();
  res.status(201).json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.patch("/office-locations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CreateOfficeLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [loc] = await db.update(officeLocationsTable).set({
    name: parsed.data.name,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radius: parsed.data.radius,
    requireApproval: parsed.data.requireApproval ?? undefined,
    isActive: parsed.data.isActive ?? undefined,
  }).where(eq(officeLocationsTable.id, id)).returning();
  if (!loc) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.delete("/office-locations/:id", async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [loc] = await db.delete(officeLocationsTable).where(eq(officeLocationsTable.id, id)).returning();
  if (!loc) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }
  res.sendStatus(204);
});

// ── Tracking ──────────────────────────────────────────
router.post("/tracking/location", async (req, res): Promise<void> => {
  const { employeeId, lat, lng, speed, accuracy } = req.body;
  if (!employeeId || lat == null || lng == null) {
    res.status(400).json({ error: "employeeId, lat, lng required" });
    return;
  }
  const [record] = await db.insert(locationTracksTable).values({
    employeeId, lat, lng, speed, accuracy,
  }).returning();
  res.json({ ...record, timestamp: record.timestamp.toISOString() });
});

router.get("/tracking/live", async (_req, res): Promise<void> => {
  // Get most recent location per employee
  const recentLocations = await db.execute(sql`
    SELECT DISTINCT ON (lt.employee_id)
      lt.employee_id as "employeeId",
      (e.first_name || ' ' || e.last_name) as "employeeName",
      d.name as designation,
      lt.lat,
      lt.lng,
      lt.speed,
      lt.timestamp as "lastUpdated",
      a.status as "attendanceStatus"
    FROM location_tracks lt
    JOIN employees e ON e.id = lt.employee_id
    LEFT JOIN designations d ON d.id = e.designation_id
    LEFT JOIN attendance a ON a.employee_id = lt.employee_id AND a.date = CURRENT_DATE
    ORDER BY lt.employee_id, lt.timestamp DESC
  `);

  const today = new Date().toISOString().split("T")[0];
  const todayAtt = await db.select().from(attendanceTable).where(eq(attendanceTable.date, today));

  res.json((recentLocations.rows as Record<string, unknown>[]).map((r) => ({
    ...r,
    lastUpdated: r.lastUpdated instanceof Date ? (r.lastUpdated as Date).toISOString() : String(r.lastUpdated),
    isActive: !todayAtt.find((a) => a.employeeId === Number(r.employeeId))?.eodSubmitted,
  })));
});

router.get("/tracking/travel-summary", async (req, res): Promise<void> => {
  const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];
  const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;

  const att = await db.select({
    employeeId: attendanceTable.employeeId,
    firstName: employeesTable.firstName,
    lastName: employeesTable.lastName,
    checkInTime: attendanceTable.checkInTime,
    checkOutTime: attendanceTable.checkOutTime,
    eodKm: attendanceTable.eodKm,
    eodVisits: attendanceTable.eodVisits,
    workingHours: attendanceTable.workingHours,
  }).from(attendanceTable)
    .leftJoin(employeesTable, eq(attendanceTable.employeeId, employeesTable.id))
    .where(
      and(
        eq(attendanceTable.date, date),
        employeeId != null ? eq(attendanceTable.employeeId, employeeId) : undefined
      )
    );

  if (att.length === 0) {
    res.json({
      date,
      employeeId: employeeId ?? null,
      totalKm: 0,
      startLocation: "N/A",
      endLocation: "N/A",
      visitCount: 0,
      workingHours: 0,
      routeSummary: null,
      idleTime: null,
      employeeName: null,
    });
    return;
  }

  const row = att[0];
  res.json({
    date,
    employeeId: row.employeeId,
    employeeName: row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : null,
    totalKm: row.eodKm ?? 0,
    startLocation: "Office",
    endLocation: "Office",
    visitCount: row.eodVisits ?? 0,
    workingHours: row.workingHours ?? 0,
    routeSummary: `${date}: ${row.eodKm ?? 0} KM, ${row.eodVisits ?? 0} visits`,
    idleTime: null,
  });
});

export default router;
