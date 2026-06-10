/**
 * /api/users  — user management for SUPER_ADMIN and ADMIN only
 */
import { Router, type IRouter } from "express";
import { eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, employeesTable } from "@workspace/db";
import { protect, authorize, type UserRole, USER_ROLES } from "../middlewares/auth.js";
import { generateUserId } from "../lib/employee-id.js";

const router: IRouter = Router();

// ── GET /users ─────────────────────────────────────────────────────────────
router.get(
  "/users",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (_req, res): Promise<void> => {
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
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      }))
    );
  }
);

// ── POST /users — create a new user ───────────────────────────────────────
router.post(
  "/users",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res): Promise<void> => {
    const { name, email, password, role = "EMPLOYEE" } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "name, email and password are required" });
      return;
    }
    if (!USER_ROLES.includes(role as UserRole)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${USER_ROLES.join(", ")}` });
      return;
    }

    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existing.length > 0) {
      res.status(400).json({ message: "A user with this email already exists" });
      return;
    }

    const userId = await generateUserId(role as UserRole);
    const hash = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        userId,
        name,
        email: email.toLowerCase(),
        password: hash,
        role: role as UserRole,
        isActive: true,
      })
      .returning({
        id: usersTable.id,
        userId: usersTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    res.status(201).json({
      ...user,
      employeeId: null,
      employeeName: null,
      lastLoginAt: null,
      createdAt: user.createdAt.toISOString(),
    });
  }
);

// ── PATCH /users/:id — toggle active/inactive, change role ────────────────
router.patch(
  "/users/:id",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10
    );
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    // Prevent self-deactivation
    if (req.user!.userId === id) {
      res.status(400).json({ message: "You cannot modify your own account here" });
      return;
    }

    const { isActive, role } = req.body;
    const updateData: Record<string, unknown> = {};

    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (role && USER_ROLES.includes(role as UserRole)) updateData.role = role;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ message: "Nothing to update. Provide isActive or role." });
      return;
    }

    const [user] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, id))
      .returning({
        id: usersTable.id,
        userId: usersTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      ...user,
      employeeId: null,
      employeeName: null,
      lastLoginAt: null,
      createdAt: user.createdAt.toISOString(),
    });
  }
);

// ── DELETE /users/:id — permanently delete (SUPER_ADMIN only) ─────────────
router.delete(
  "/users/:id",
  protect,
  authorize("SUPER_ADMIN"),
  async (req, res): Promise<void> => {
    const id = parseInt(
      Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
      10
    );
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }
    if (req.user!.userId === id) {
      res.status(400).json({ message: "You cannot delete your own account" });
      return;
    }

    const [user] = await db
      .delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning({ id: usersTable.id });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.sendStatus(204);
  }
);

export default router;
