import { db, usersTable, employeesTable, departmentsTable } from "@workspace/db";
import { eq, like, sql } from "drizzle-orm";
import type { UserRole } from "../middlewares/auth.js";

/**
 * Role → prefix map — exactly matching hrms-backend authController.js
 *
 *   SUPER_ADMIN  → SA
 *   ADMIN        → ADM
 *   HR           → HR
 *   MANAGER      → MGR
 *   TEAM_LEADER  → TL
 *   EMPLOYEE     → EMP
 *   INTERN       → INT
 */
export const ROLE_PREFIX: Record<UserRole, string> = {
  SUPER_ADMIN: "SA",
  ADMIN:       "ADM",
  HR:          "HR",
  MANAGER:     "MGR",
  TEAM_LEADER: "TL",
  EMPLOYEE:    "EMP",
  INTERN:      "INT",
};

// ── generateUserId ─────────────────────────────────────────────────────────────
// Generates role-based userId: e.g. SA1, HR3, MGR7, EMP42
// Matches hrms-backend authController register logic exactly
export async function generateUserId(role: UserRole): Promise<string> {
  const prefix = ROLE_PREFIX[role] ?? "EMP";
  const rows = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, role));
  const count = rows.length;
  return `${prefix}${count + 1}`;
}

// ── generateEmployeeId ─────────────────────────────────────────────────────────
// Generates the employee profile code: ROLE-DEPT-SEQUENCE
// e.g.  MGR-ENG-0001, FLD-SLS-0042, DSK-HR-0005
// Used when creating an employee profile record (separate from the auth userId)
export async function generateEmployeeId(
  role: string,
  deptName: string | null | undefined
): Promise<string> {
  // Map hrmcoresystem employee roles to hrms-backend style prefixes
  const rolePrefixMap: Record<string, string> = {
    "Super Admin":     "SA",
    "HR Admin":        "HR",
    "Manager":         "MGR",
    "Team Leader":     "TL",
    "Field Executive": "FLD",
    "Desk Employee":   "DSK",
    "Intern":          "INT",
  };

  const rolePrefix = rolePrefixMap[role] ?? "EMP";
  const deptPrefix = deptName
    ? deptName.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() || "GEN"
    : "GEN";

  const prefix = `${rolePrefix}-${deptPrefix}-`;

  // Count how many already have this prefix
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employeesTable)
    .where(like(employeesTable.employeeId, `${prefix}%`));

  const nextSeq = (result?.count ?? 0) + 1;
  const candidateId = `${prefix}${String(nextSeq).padStart(4, "0")}`;

  // Safety: verify uniqueness
  const existing = await db
    .select({ employeeId: employeesTable.employeeId })
    .from(employeesTable)
    .where(like(employeesTable.employeeId, `${prefix}%`));

  const existingSet = new Set(existing.map((e) => e.employeeId));
  if (!existingSet.has(candidateId)) return candidateId;

  // Find next free slot
  for (let i = nextSeq + 1; i < nextSeq + 9999; i++) {
    const id = `${prefix}${String(i).padStart(4, "0")}`;
    if (!existingSet.has(id)) return id;
  }

  return `${prefix}${Date.now().toString().slice(-6)}`;
}
