import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  attendanceTable,
  employeesTable,
  officeLocationsTable,
  locationTracksTable,
  attendanceSettingsTable,
} from "@workspace/db";
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
import { protect, authorize } from "../middlewares/auth.js";

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

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getOrCreateSettings() {
  const rows = await db.select().from(attendanceSettingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [s] = await db.insert(attendanceSettingsTable).values({}).returning();
  return s;
}

// ── Attendance Settings ────────────────────────────────
router.get("/attendance/settings", protect, async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(settings);
});

router.put("/attendance/settings", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const {
    presentBeforeMins,
    lateBeforeMins,
    halfDayBeforeMins,
    geoFencingEnabled,
    outsideRadiusAction,
  } = req.body;

  const settings = await getOrCreateSettings();

  const [updated] = await db
    .update(attendanceSettingsTable)
    .set({
      ...(presentBeforeMins !== undefined && { presentBeforeMins }),
      ...(lateBeforeMins !== undefined && { lateBeforeMins }),
      ...(halfDayBeforeMins !== undefined && { halfDayBeforeMins }),
      ...(geoFencingEnabled !== undefined && { geoFencingEnabled }),
      ...(outsideRadiusAction !== undefined && { outsideRadiusAction }),
      updatedAt: new Date(),
    })
    .where(eq(attendanceSettingsTable.id, settings.id))
    .returning();

  res.json(updated);
});

// ── Attendance List ────────────────────────────────────
router.get("/attendance", protect, async (req, res): Promise<void> => {
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
        month != null
          ? sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`
          : undefined
      )
    )
    .orderBy(attendanceTable.date);

  res.json(rows.map(fmtAttendance));
});

// ── Day Start (Smart Attendance) ───────────────────────
router.post("/attendance/day-start", protect, async (req, res): Promise<void> => {
  const parsed = DayStartBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getOrCreateSettings();
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();

  // Compute time-based status using configurable rules
  let status = "Present";
  let requiresApproval = false;

  if (totalMins >= settings.halfDayBeforeMins) {
    status = "Half Day";
    requiresApproval = true;
  } else if (totalMins >= settings.lateBeforeMins) {
    status = "Half Day";
  } else if (totalMins >= settings.presentBeforeMins) {
    status = "Late";
  }

  // Geo-fence validation
  let geoFenceStatus = "not_checked";
  let geoFenceBlocked = false;

  if (
    settings.geoFencingEnabled &&
    parsed.data.lat != null &&
    parsed.data.lng != null
  ) {
    const activeLocations = await db
      .select()
      .from(officeLocationsTable)
      .where(eq(officeLocationsTable.isActive, true));

    if (activeLocations.length > 0) {
      const withDist = activeLocations
        .map((loc) => ({
          ...loc,
          distance: haversineDistance(parsed.data.lat!, parsed.data.lng!, loc.lat, loc.lng),
        }))
        .sort((a, b) => a.distance - b.distance);

      const nearest = withDist[0];

      if (nearest.distance <= nearest.radius) {
        geoFenceStatus = "inside_radius";
      } else {
        geoFenceStatus = "outside_radius";
        if (settings.outsideRadiusAction === "block") {
          geoFenceBlocked = true;
        } else if (settings.outsideRadiusAction === "approve") {
          requiresApproval = true;
        }
      }
    } else {
      geoFenceStatus = "no_locations";
    }
  }

  if (geoFenceBlocked) {
    res.status(403).json({
      error: "Attendance blocked: You are outside the allowed office radius.",
      geoFenceStatus,
    });
    return;
  }

  const approvalStatus = requiresApproval ? "Pending" : null;

  // Upsert attendance record
  const existing = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, parsed.data.employeeId),
        eq(attendanceTable.date, today)
      )
    );

  let record;
  if (existing.length > 0) {
    const [r] = await db
      .update(attendanceTable)
      .set({
        checkInTime: now,
        checkInLat: parsed.data.lat ?? undefined,
        checkInLng: parsed.data.lng ?? undefined,
        checkInSelfie: parsed.data.selfieUrl,
        status,
        approvalStatus: approvalStatus ?? undefined,
        remarks: parsed.data.remarks ?? undefined,
      })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();
    record = r;
  } else {
    const [r] = await db
      .insert(attendanceTable)
      .values({
        employeeId: parsed.data.employeeId,
        date: today,
        status,
        checkInTime: now,
        checkInLat: parsed.data.lat ?? undefined,
        checkInLng: parsed.data.lng ?? undefined,
        checkInSelfie: parsed.data.selfieUrl,
        approvalStatus: approvalStatus ?? undefined,
        remarks: parsed.data.remarks ?? undefined,
      })
      .returning();
    record = r;
  }

  res.status(201).json({ ...fmtAttendance(record), geoFenceStatus });
});

// ── Day End ────────────────────────────────────────────
router.post("/attendance/day-end", protect, async (req, res): Promise<void> => {
  const parsed = DayEndBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const existing = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.employeeId, parsed.data.employeeId),
        eq(attendanceTable.date, today)
      )
    );

  if (existing.length === 0) {
    res.status(404).json({
      error: "No attendance record found for today. Please start your day first.",
    });
    return;
  }

  const checkIn = existing[0].checkInTime;
  const checkOut = new Date();
  const workingHours = checkIn
    ? (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
    : 0;

  const [record] = await db
    .update(attendanceTable)
    .set({
      checkOutTime: checkOut,
      workingHours: Math.round(workingHours * 100) / 100,
      eodSubmitted: true,
      eodVisits: parsed.data.eodVisits,
      eodKm: parsed.data.eodKm,
      eodLeads: parsed.data.eodLeads,
      eodOrders: parsed.data.eodOrders,
      eodCollection: parsed.data.eodCollection,
      eodRemarks: parsed.data.eodRemarks ?? undefined,
      distanceTravelled: parsed.data.eodKm,
    })
    .where(eq(attendanceTable.id, existing[0].id))
    .returning();

  res.json(fmtAttendance(record));
});

// ── Approve Attendance ─────────────────────────────────
router.patch("/attendance/:id/approve", protect, authorize("SUPER_ADMIN", "ADMIN", "HR", "MANAGER"), async (req, res): Promise<void> => {
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

  const [record] = await db
    .update(attendanceTable)
    .set({
      approvalStatus: parsed.data.action,
      approvedBy: parsed.data.approvedBy ?? undefined,
      remarks: parsed.data.remarks ?? undefined,
    })
    .where(eq(attendanceTable.id, params.data.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  res.json(fmtAttendance(record));
});

// ── Attendance Summary ─────────────────────────────────
router.get("/attendance/summary", protect, async (req, res): Promise<void> => {
  const query = GetAttendanceSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const month = query.data.month ?? new Date().toISOString().slice(0, 7);

  const rows = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        sql`to_char(${attendanceTable.date}::date, 'YYYY-MM') = ${month}`,
        query.data.employeeId != null
          ? eq(attendanceTable.employeeId, query.data.employeeId)
          : undefined
      )
    );

  res.json({
    totalPresent: rows.filter((r) => r.status === "Present").length,
    totalAbsent: rows.filter((r) => r.status === "Absent").length,
    totalHalfDay: rows.filter((r) => r.status === "Half Day").length,
    totalLate: rows.filter((r) => r.status === "Late").length,
    totalLeave: rows.filter((r) => r.status === "On Leave").length,
    totalWfh: rows.filter((r) => r.status === "WFH").length,
    totalOutdoor: rows.filter((r) => r.status === "Outdoor Duty").length,
    attendanceRate:
      rows.length > 0
        ? Math.round(
            (rows.filter((r) => ["Present", "Late", "Half Day"].includes(r.status)).length /
              rows.length) *
              100
          )
        : 0,
    month,
  });
});

// ── Today's Attendance ─────────────────────────────────
router.get("/attendance/today", protect, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const totalEmployees = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(eq(employeesTable.status, "active"));
  const todayRows = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today));

  res.json({
    date: today,
    presentCount: todayRows.filter((r) =>
      ["Present", "WFH", "Outdoor Duty"].includes(r.status)
    ).length,
    absentCount: todayRows.filter((r) => r.status === "Absent").length,
    lateCount: todayRows.filter((r) => r.status === "Late").length,
    onLeaveCount: todayRows.filter((r) => r.status === "On Leave").length,
    fieldCount: todayRows.filter((r) => r.status === "Outdoor Duty").length,
    notCheckedIn:
      (totalEmployees[0]?.count ?? 0) - todayRows.length,
    activeFieldExecutives: todayRows.filter(
      (r) => r.status === "Outdoor Duty" && !r.eodSubmitted
    ).length,
  });
});

// ── Office Locations ───────────────────────────────────
router.get("/office-locations", protect, async (_req, res): Promise<void> => {
  const locs = await db
    .select()
    .from(officeLocationsTable)
    .orderBy(officeLocationsTable.name);
  res.json(locs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

router.post("/office-locations", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateOfficeLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [loc] = await db
    .insert(officeLocationsTable)
    .values({
      name: parsed.data.name,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radius: parsed.data.radius,
      requireApproval: parsed.data.requireApproval ?? false,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();
  res.status(201).json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.patch("/office-locations/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10
  );
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = CreateOfficeLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [loc] = await db
    .update(officeLocationsTable)
    .set({
      name: parsed.data.name,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      radius: parsed.data.radius,
      requireApproval: parsed.data.requireApproval ?? undefined,
      isActive: parsed.data.isActive ?? undefined,
    })
    .where(eq(officeLocationsTable.id, id))
    .returning();
  if (!loc) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }
  res.json({ ...loc, createdAt: loc.createdAt.toISOString() });
});

router.delete("/office-locations/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10
  );
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [loc] = await db
    .delete(officeLocationsTable)
    .where(eq(officeLocationsTable.id, id))
    .returning();
  if (!loc) {
    res.status(404).json({ error: "Office location not found" });
    return;
  }
  res.sendStatus(204);
});

// ── Live Tracking ──────────────────────────────────────
router.post("/tracking/location", protect, async (req, res): Promise<void> => {
  const { employeeId, lat, lng, speed, accuracy } = req.body;
  if (!employeeId || lat == null || lng == null) {
    res.status(400).json({ error: "employeeId, lat, lng required" });
    return;
  }
  const [record] = await db
    .insert(locationTracksTable)
    .values({ employeeId, lat, lng, speed, accuracy })
    .returning();
  res.json({ ...record, timestamp: record.timestamp.toISOString() });
});

router.get("/tracking/live", protect, async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]!;

  // First try location_tracks (real-time GPS pings)
  const recentLocations = await db.execute(sql`
    SELECT DISTINCT ON (lt.employee_id)
      lt.employee_id   AS "employeeId",
      (e.first_name || ' ' || e.last_name) AS "employeeName",
      d.name           AS designation,
      lt.lat,
      lt.lng,
      lt.speed,
      lt.timestamp     AS "lastUpdated",
      'gps'            AS source
    FROM location_tracks lt
    JOIN employees e ON e.id = lt.employee_id
    LEFT JOIN designations d ON d.id = e.designation_id
    ORDER BY lt.employee_id, lt.timestamp DESC
  `);

  // Also pull employees who marked attendance today with GPS coordinates
  // These show up if no live GPS ping exists yet
  const attendanceLocations = await db.execute(sql`
    SELECT
      a.employee_id   AS "employeeId",
      (e.first_name || ' ' || e.last_name) AS "employeeName",
      d.name           AS designation,
      a.check_in_lat  AS lat,
      a.check_in_lng  AS lng,
      NULL            AS speed,
      a.check_in_time AS "lastUpdated",
      'attendance'    AS source,
      a.eod_submitted AS "eodSubmitted"
    FROM attendance a
    JOIN employees e ON e.id = a.employee_id
    LEFT JOIN designations d ON d.id = e.designation_id
    WHERE a.date = ${today}
      AND a.check_in_lat IS NOT NULL
      AND a.check_in_lng IS NOT NULL
  `);

  // Merge: location_track entries take priority; attendance check-in fills gaps
  const trackIds = new Set(
    (recentLocations.rows as any[]).map((r) => Number(r.employeeId))
  );

  const attRows = (attendanceLocations.rows as any[]).filter(
    (r) => !trackIds.has(Number(r.employeeId))
  );

  const allRows = [
    ...(recentLocations.rows as any[]),
    ...attRows,
  ];

  // Determine isActive: active = checked-in today AND not yet checked-out
  const todayAtt = await db
    .select({
      employeeId: attendanceTable.employeeId,
      eodSubmitted: attendanceTable.eodSubmitted,
      checkOutTime: attendanceTable.checkOutTime,
    })
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today));

  const attMap = new Map(todayAtt.map((a) => [a.employeeId, a]));

  res.json(
    allRows.map((r: any) => {
      const att = attMap.get(Number(r.employeeId));
      return {
        employeeId: Number(r.employeeId),
        employeeName: r.employeeName ?? "",
        designation: r.designation ?? null,
        lat: Number(r.lat),
        lng: Number(r.lng),
        speed: r.speed != null ? Number(r.speed) : null,
        lastUpdated:
          r.lastUpdated instanceof Date
            ? r.lastUpdated.toISOString()
            : String(r.lastUpdated),
        // Active = checked in today, has GPS, not yet submitted EOD
        isActive: att != null && !att.eodSubmitted && att.checkOutTime == null,
        source: r.source ?? "unknown",
      };
    })
  );
});

router.get("/tracking/travel-summary", protect, async (req, res): Promise<void> => {
  const date =
    (req.query.date as string) ?? new Date().toISOString().split("T")[0];
  const employeeId = req.query.employeeId
    ? parseInt(req.query.employeeId as string, 10)
    : null;

  const att = await db
    .select({
      employeeId: attendanceTable.employeeId,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
      checkInTime: attendanceTable.checkInTime,
      checkOutTime: attendanceTable.checkOutTime,
      eodKm: attendanceTable.eodKm,
      eodVisits: attendanceTable.eodVisits,
      workingHours: attendanceTable.workingHours,
    })
    .from(attendanceTable)
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
    employeeName:
      row.firstName && row.lastName ? `${row.firstName} ${row.lastName}` : null,
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
