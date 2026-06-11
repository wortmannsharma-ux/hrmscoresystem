/**
 * /api/users  — user management for SUPER_ADMIN and ADMIN only
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, employeesTable, departmentsTable, pool } from "@workspace/db";
import { protect, authorize, type UserRole, USER_ROLES } from "../middlewares/auth.js";
import { generateUserId, generateEmployeeId } from "../lib/employee-id.js";

const router: IRouter = Router();

// Roles that should NOT get auto-created employee records
const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN"];

// Map user roles to employee role strings used in the employees table
const USER_ROLE_TO_EMPLOYEE_ROLE: Record<string, string> = {
  HR:          "HR Admin",
  MANAGER:     "Manager",
  TEAM_LEADER: "Team Leader",
  EMPLOYEE:    "Desk Employee",
  INTERN:      "Intern",
};

// ── GET /users ─────────────────────────────────────────────────────────────
router.get(
  "/users",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (_req, res): Promise<void> => {
    try {
      const rows = await db
        .select({
          id: usersTable.id,
          userId: usersTable.userId,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          isActive: usersTable.isActive,
          employeeId: usersTable.employeeId,
          lastLoginAt: usersTable.lastLoginAt,
          createdAt: usersTable.createdAt,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
          profilePhoto: employeesTable.profilePhoto,
        })
        .from(usersTable)
        .leftJoin(employeesTable, eq(usersTable.employeeId, employeesTable.id))
        .orderBy(usersTable.createdAt);

      res.json(
        rows.map((u) => ({
          id: u.id,
          userId: u.userId,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          employeeId: u.employeeId,
          employeeName:
            u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : null,
          profilePhoto: u.profilePhoto ?? null,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          createdAt: u.createdAt.toISOString(),
        }))
      );
    } catch (err: unknown) {
      console.error("[GET /users]", err);
      res.status(500).json({ message: (err as any)?.message ?? "Internal server error" });
    }
  }
);

// ── POST /users — create a new user ───────────────────────────────────────
router.post(
  "/users",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
    try {
      const { name, email, password, role = "EMPLOYEE", departmentId, phone } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ message: "name, email and password are required" });
        return;
      }
      if (!USER_ROLES.includes(role as UserRole)) {
        res.status(400).json({ message: `Invalid role. Must be one of: ${USER_ROLES.join(", ")}` });
        return;
      }

      // HR cannot create SUPER_ADMIN or ADMIN accounts
      const callerRole = req.user!.role;
      if (callerRole === "HR" && ADMIN_ROLES.includes(role as UserRole)) {
        res.status(403).json({ message: "HR cannot create Admin or Super Admin accounts" });
        return;
      }

      // Check duplicate user email
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email.toLowerCase()));

      if (existing.length > 0) {
        res.status(400).json({ message: "A user with this email already exists" });
        return;
      }

      // Check employee table for this email
      // - If an employee exists but is already linked to a different user → block
      // - If an employee exists and is unlinked → we'll link it after user creation
      // - If no employee exists → we'll create one
      const existingEmpRows = await pool.query<{ id: number; employee_id: string }>(
        `SELECT e.id, e.employee_id
         FROM employees e
         LEFT JOIN users u ON u.employee_id = e.id
         WHERE e.email = $1`,
        [email.toLowerCase()]
      );

      let reuseEmployeeId: number | null = null;
      if (existingEmpRows.rows.length > 0) {
        // Check if it's already linked to another user
        const linkedCheck = await pool.query<{ id: number }>(
          `SELECT u.id FROM users u WHERE u.employee_id = $1`,
          [existingEmpRows.rows[0]!.id]
        );
        if (linkedCheck.rows.length > 0) {
          res.status(400).json({ message: "An employee record with this email is already linked to another user account." });
          return;
        }
        // Unlinked employee — reuse it
        reuseEmployeeId = existingEmpRows.rows[0]!.id;
      }

      const userId = await generateUserId(role as UserRole);
      const hash = await bcrypt.hash(password, 10);

      // Use raw SQL insert to avoid Drizzle column-order issues with legacy DB schema
      const insertResult = await pool.query<{
        id: number; user_id: string; name: string; email: string;
        role: string; is_active: boolean; created_at: Date;
      }>(
        `INSERT INTO users (user_id, name, email, password, role, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, user_id, name, email, role, is_active, created_at`,
        [userId, name, email.toLowerCase(), hash, role]
      );

      const user = insertResult.rows[0]!;

      // For non-admin roles, create or link an employee record
      let linkedEmployeeId: number | null = null;
      let employeeName: string | null = null;

      if (!ADMIN_ROLES.includes(role as UserRole)) {
        if (reuseEmployeeId !== null) {
          // Reuse existing unlinked employee record
          const empRow = await pool.query<{ id: number; first_name: string; last_name: string }>(
            `UPDATE employees SET role = $1 WHERE id = $2 RETURNING id, first_name, last_name`,
            [USER_ROLE_TO_EMPLOYEE_ROLE[role] ?? "Desk Employee", reuseEmployeeId]
          );
          linkedEmployeeId = empRow.rows[0]!.id;
          employeeName = `${empRow.rows[0]!.first_name} ${empRow.rows[0]!.last_name}`;
        } else {
          // Create a new employee record
          let deptName: string | null = null;
          if (departmentId) {
            const deptRow = await pool.query<{ name: string }>(
              `SELECT name FROM departments WHERE id = $1`,
              [Number(departmentId)]
            );
            deptName = deptRow.rows[0]?.name ?? null;
          }

          const employeeRole = USER_ROLE_TO_EMPLOYEE_ROLE[role] ?? "Desk Employee";
          const empId = await generateEmployeeId(employeeRole, deptName);

          const nameParts = name.trim().split(" ");
          const firstName = nameParts[0] ?? name;
          const lastName = nameParts.slice(1).join(" ") || firstName;
          const today = new Date().toISOString().split("T")[0]!;

          const empInsert = await pool.query<{ id: number; first_name: string; last_name: string }>(
            `INSERT INTO employees (employee_id, first_name, last_name, email, phone, role, status, joining_date, department_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
             RETURNING id, first_name, last_name`,
            [empId, firstName, lastName, email.toLowerCase(), (phone ?? "").trim(),
             employeeRole, today, departmentId ? Number(departmentId) : null]
          );
          linkedEmployeeId = empInsert.rows[0]!.id;
          employeeName = `${empInsert.rows[0]!.first_name} ${empInsert.rows[0]!.last_name}`;
        }

        // Link employee to the new user
        await pool.query(
          `UPDATE users SET employee_id = $1 WHERE id = $2`,
          [linkedEmployeeId, user.id]
        );
      }

      res.status(201).json({
        id: user.id,
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        employeeId: linkedEmployeeId,
        employeeName,
        lastLoginAt: null,
        createdAt: user.created_at.toISOString(),
      });
    } catch (err: unknown) {
      const message = (err as any)?.message ?? "Internal server error";
      // Postgres unique violation code
      if ((err as any)?.code === "23505") {
        res.status(400).json({ message: "A user or employee with this email already exists." });
        return;
      }
      console.error("[POST /users]", err);
      res.status(500).json({ message });
    }
  }
);

// ── PATCH /users/:id — toggle active/inactive, change role ────────────────
router.patch(
  "/users/:id",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(
        Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10
      );
      if (isNaN(id)) { res.status(400).json({ message: "Invalid user id" }); return; }
      if (req.user!.userId === id) { res.status(400).json({ message: "You cannot modify your own account here" }); return; }

      const [target] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
      if (!target) { res.status(404).json({ message: "User not found" }); return; }

      const callerRole = req.user!.role;
      if (callerRole === "HR" && ADMIN_ROLES.includes(target.role as UserRole)) {
        res.status(403).json({ message: "HR cannot modify Admin or Super Admin accounts" }); return;
      }

      const { isActive, role } = req.body;
      const updateData: Record<string, unknown> = {};
      if (typeof isActive === "boolean") updateData.isActive = isActive;
      if (role && USER_ROLES.includes(role as UserRole)) updateData.role = role;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ message: "Nothing to update. Provide isActive or role." }); return;
      }

      const [user] = await db
        .update(usersTable).set(updateData).where(eq(usersTable.id, id))
        .returning({
          id: usersTable.id, userId: usersTable.userId, name: usersTable.name,
          email: usersTable.email, role: usersTable.role, isActive: usersTable.isActive,
          employeeId: usersTable.employeeId, createdAt: usersTable.createdAt,
        });

      if (!user) { res.status(404).json({ message: "User not found" }); return; }

      let employeeName: string | null = null;
      if (user.employeeId) {
        const [emp] = await db
          .select({ firstName: employeesTable.firstName, lastName: employeesTable.lastName })
          .from(employeesTable).where(eq(employeesTable.id, user.employeeId));
        if (emp) employeeName = `${emp.firstName} ${emp.lastName}`;
      }

      res.json({ ...user, employeeId: user.employeeId ?? null, employeeName, lastLoginAt: null, createdAt: user.createdAt.toISOString() });
    } catch (err: unknown) {
      console.error("[PATCH /users/:id]", err);
      res.status(500).json({ message: (err as any)?.message ?? "Internal server error" });
    }
  }
);

// ── POST /users/:id/reset-password — admin/HR reset without old password ──
router.post(
  "/users/:id/reset-password",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
      if (isNaN(id)) { res.status(400).json({ message: "Invalid user id" }); return; }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ message: "newPassword must be at least 6 characters" }); return;
      }

      const rows = await db.select({ id: usersTable.id, role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
      if (!rows.length) { res.status(404).json({ message: "User not found" }); return; }

      const callerRole = req.user!.role;
      if (callerRole === "HR" && ADMIN_ROLES.includes(rows[0]!.role as UserRole)) {
        res.status(403).json({ message: "HR cannot reset passwords for Admin accounts" }); return;
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await db.update(usersTable).set({ password: hashed, updatedAt: new Date() }).where(eq(usersTable.id, id));
      res.json({ message: "Password reset successfully" });
    } catch (err: unknown) {
      console.error("[POST /users/:id/reset-password]", err);
      res.status(500).json({ message: (err as any)?.message ?? "Internal server error" });
    }
  }
);

// ── DELETE /users/:id — permanently delete (SUPER_ADMIN only) ─────────────
router.delete(
  "/users/:id",
  protect,
  authorize("SUPER_ADMIN"),
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
      if (isNaN(id)) { res.status(400).json({ message: "Invalid user id" }); return; }
      if (req.user!.userId === id) { res.status(400).json({ message: "You cannot delete your own account" }); return; }

      const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
      if (!user) { res.status(404).json({ message: "User not found" }); return; }

      res.sendStatus(204);
    } catch (err: unknown) {
      console.error("[DELETE /users/:id]", err);
      res.status(500).json({ message: (err as any)?.message ?? "Internal server error" });
    }
  }
);

export default router;
