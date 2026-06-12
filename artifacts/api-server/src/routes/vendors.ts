import { Router, type IRouter } from "express";
import { eq, and, sql, ilike } from "drizzle-orm";
import { db, vendorsTable, visitsTable, employeesTable, attendanceTable } from "@workspace/db";
import {
  ListVendorsQueryParams,
  CreateVendorBody,
  GetVendorParams,
  UpdateVendorParams,
  UpdateVendorBody,
  ListVisitsQueryParams,
  CreateVisitBody,
  GetVisitParams,
  GetVisitSummaryQueryParams,
} from "@workspace/api-zod";
import { protect, authorize } from "../middlewares/auth.js";

const router: IRouter = Router();

function fmtVisit(v: typeof visitsTable.$inferSelect & { vendorName?: string | null; employeeName?: string | null }) {
  return {
    ...v,
    vendorName: v.vendorName ?? null,
    employeeName: v.employeeName ?? null,
    checkInTime: v.checkInTime?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
  };
}

// ── Vendors ───────────────────────────────────────────
router.get("/vendors", protect, async (req, res): Promise<void> => {
  const query = ListVendorsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db.select().from(vendorsTable).where(
    query.data.search != null ? ilike(vendorsTable.name, `%${query.data.search}%`) : undefined
  ).orderBy(vendorsTable.name);

  // get visit counts
  const counts = await db.select({
    vendorId: visitsTable.vendorId,
    count: sql<number>`count(*)::int`,
    lastVisit: sql<string>`max(${visitsTable.visitDate})`,
  }).from(visitsTable).groupBy(visitsTable.vendorId);
  const countMap = new Map(counts.map((c) => [c.vendorId, { count: c.count, lastVisit: c.lastVisit }]));

  res.json(rows.map((v) => ({
    ...v,
    visitCount: countMap.get(v.id)?.count ?? 0,
    lastVisit: countMap.get(v.id)?.lastVisit ?? null,
    createdAt: v.createdAt.toISOString(),
  })));
});

router.post("/vendors", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [vendor] = await db.insert(vendorsTable).values({
    name: parsed.data.name,
    contactPerson: parsed.data.contactPerson ?? undefined,
    mobile: parsed.data.mobile ?? undefined,
    email: parsed.data.email ?? undefined,
    address: parsed.data.address ?? undefined,
    lat: parsed.data.lat ?? undefined,
    lng: parsed.data.lng ?? undefined,
    radius: parsed.data.radius ?? undefined,
  }).returning();
  res.status(201).json({ ...vendor, visitCount: 0, lastVisit: null, createdAt: vendor.createdAt.toISOString() });
});

router.get("/vendors/:id", protect, async (req, res): Promise<void> => {
  const params = GetVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, params.data.id));
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json({ ...vendor, visitCount: 0, lastVisit: null, createdAt: vendor.createdAt.toISOString() });
});

router.patch("/vendors/:id", protect, authorize("SUPER_ADMIN", "ADMIN", "HR"), async (req, res): Promise<void> => {
  const params = UpdateVendorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  const [vendor] = await db.update(vendorsTable).set(updateData).where(eq(vendorsTable.id, params.data.id)).returning();
  if (!vendor) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json({ ...vendor, visitCount: 0, lastVisit: null, createdAt: vendor.createdAt.toISOString() });
});

// ── Visits ────────────────────────────────────────────
router.get("/visits", protect, async (req, res): Promise<void> => {
  const query = ListVisitsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { employeeId, vendorId, date, status } = query.data;

  const rows = await db.select({
    id: visitsTable.id,
    employeeId: visitsTable.employeeId,
    employeeName: sql<string>`${employeesTable.firstName} || ' ' || ${employeesTable.lastName}`,
    vendorId: visitsTable.vendorId,
    vendorName: vendorsTable.name,
    visitDate: visitsTable.visitDate,
    checkInTime: visitsTable.checkInTime,
    selfieUrl: visitsTable.selfieUrl,
    lat: visitsTable.lat,
    lng: visitsTable.lng,
    remarks: visitsTable.remarks,
    meetingNotes: visitsTable.meetingNotes,
    orderValue: visitsTable.orderValue,
    nextFollowUp: visitsTable.nextFollowUp,
    status: visitsTable.status,
    invalidReason: visitsTable.invalidReason,
    createdAt: visitsTable.createdAt,
  })
    .from(visitsTable)
    .leftJoin(employeesTable, eq(visitsTable.employeeId, employeesTable.id))
    .leftJoin(vendorsTable, eq(visitsTable.vendorId, vendorsTable.id))
    .where(
      and(
        employeeId != null ? eq(visitsTable.employeeId, employeeId) : undefined,
        vendorId != null ? eq(visitsTable.vendorId, vendorId) : undefined,
        date != null ? eq(visitsTable.visitDate, date) : undefined,
        status != null ? eq(visitsTable.status, status) : undefined
      )
    )
    .orderBy(visitsTable.createdAt);

  res.json(rows.map(fmtVisit));
});

router.post("/visits", protect, async (req, res): Promise<void> => {
  const parsed = CreateVisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // Validate GPS against vendor radius
  let visitStatus = "Valid";
  let invalidReason = null;
  if (parsed.data.lat && parsed.data.lng) {
    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, parsed.data.vendorId));
    if (vendor && vendor.lat && vendor.lng && vendor.radius) {
      const R = 6371000;
      const dLat = (vendor.lat - parsed.data.lat) * Math.PI / 180;
      const dLng = (vendor.lng - parsed.data.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(parsed.data.lat * Math.PI / 180) * Math.cos(vendor.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (dist > vendor.radius) {
        visitStatus = "Invalid";
        invalidReason = `Outside allowed radius of ${vendor.radius}m (distance: ${Math.round(dist)}m)`;
      }
    }
  } else {
    visitStatus = "Invalid";
    invalidReason = "GPS location not provided";
  }

  const [visit] = await db.insert(visitsTable).values({
    employeeId: parsed.data.employeeId,
    vendorId: parsed.data.vendorId,
    visitDate: today,
    checkInTime: new Date(),
    selfieUrl: parsed.data.selfieUrl,
    lat: parsed.data.lat ?? undefined,
    lng: parsed.data.lng ?? undefined,
    remarks: parsed.data.remarks ?? undefined,
    meetingNotes: parsed.data.meetingNotes ?? undefined,
    orderValue: parsed.data.orderValue ?? undefined,
    nextFollowUp: parsed.data.nextFollowUp ?? undefined,
    status: visitStatus,
    invalidReason: invalidReason ?? undefined,
  }).returning();

  res.status(201).json(fmtVisit({ ...visit, vendorName: null, employeeName: null }));
});

router.get("/visits/summary", protect, async (req, res): Promise<void> => {
  const query = GetVisitSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const date = query.data.date ?? new Date().toISOString().split("T")[0];
  const employeeId = query.data.employeeId;

  const rows = await db.select().from(visitsTable).where(
    and(
      eq(visitsTable.visitDate, date),
      employeeId != null ? eq(visitsTable.employeeId, employeeId) : undefined
    )
  );

  const att = employeeId != null ? await db.select().from(attendanceTable).where(
    and(
      eq(attendanceTable.employeeId, employeeId),
      eq(attendanceTable.date, date)
    )
  ) : [];

  res.json({
    date,
    employeeId: employeeId ?? null,
    totalVisits: rows.length,
    validVisits: rows.filter((v) => v.status === "Valid").length,
    invalidVisits: rows.filter((v) => v.status === "Invalid").length,
    totalKm: att[0]?.eodKm ?? 0,
    workingHours: att[0]?.workingHours ?? 0,
    ordersCollected: rows.filter((v) => v.orderValue != null).length,
    collectionAmount: rows.reduce((s, v) => s + (v.orderValue ?? 0), 0),
    routeSummary: null,
  });
});

router.get("/visits/:id", protect, async (req, res): Promise<void> => {
  const params = GetVisitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [visit] = await db.select().from(visitsTable).where(eq(visitsTable.id, params.data.id));
  if (!visit) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
  res.json(fmtVisit({ ...visit, vendorName: null, employeeName: null }));
});

export default router;
