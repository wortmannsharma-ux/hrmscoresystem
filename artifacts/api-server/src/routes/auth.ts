import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, employeesTable } from "@workspace/db";
import { protect, authorize, signToken, type UserRole, USER_ROLES } from "../middlewares/auth.js";
import { generateUserId } from "../lib/employee-id.js";
import { z } from "zod";

const router: IRouter = Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Matches hrms-backend: POST /api/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const { name, email, password, role = "EMPLOYEE" } = req.body;

    // Validate required fields (same check as hrms-backend)
    if (!name || !email || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    // Validate role
    if (!USER_ROLES.includes(role as UserRole)) {
      res.status(400).json({ message: `Invalid role. Must be one of: ${USER_ROLES.join(", ")}` });
      return;
    }

    // Check existing user
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existing.length > 0) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Generate role-based userId (SA1, HR2, MGR3 etc.) — same as hrms-backend
    const userId = await generateUserId(role as UserRole);

    // Hash password (10 rounds matching hrms-backend)
    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await db
      .insert(usersTable)
      .values({
        userId,
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: role as UserRole,
        isActive: true,
      })
      .returning({
        id: usersTable.id,
        userId: usersTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
      });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Matches hrms-backend: POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // Fetch user + linked employee info
    const rows = await db
      .select({
        id: usersTable.id,
        userId: usersTable.userId,
        name: usersTable.name,
        email: usersTable.email,
        password: usersTable.password,
        role: usersTable.role,
        isActive: usersTable.isActive,
        employeeId: usersTable.employeeId,
        // Employee details if linked
        employeeFirstName: employeesTable.firstName,
        employeeLastName: employeesTable.lastName,
        profilePhoto: employeesTable.profilePhoto,
      })
      .from(usersTable)
      .leftJoin(employeesTable, eq(usersTable.employeeId, employeesTable.id))
      .where(eq(usersTable.email, email.toLowerCase()));

    const user = rows[0];

    if (!user) {
      res.status(400).json({ message: "Invalid Email" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ message: "Account deactivated. Contact HR." });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(400).json({ message: "Invalid Password" });
      return;
    }

    // Update last login
    await db
      .update(usersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(usersTable.id, user.id));

    // Sign token — carries id + role (same as hrms-backend)
    const token = signToken({
      id: user.id,
      userId: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    });

    res.json({
      message: "Login Successful",
      token,
      user: {
        id: user.id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        firstName: user.employeeFirstName,
        lastName: user.employeeLastName,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ message: "Server Error", error: (err as Error).message });
  }
});

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
// Matches hrms-backend: PUT /api/auth/change-password
router.put("/auth/change-password", async (req, res): Promise<void> => {
  try {
    const { email, oldPassword, newPassword } = req.body;

    const rows = await db
      .select({ id: usersTable.id, password: usersTable.password })
      .from(usersTable)
      .where(eq(usersTable.email, email?.toLowerCase() ?? ""));

    const user = rows[0];
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      res.status(400).json({ message: "Old password is incorrect" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db
      .update(usersTable)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ message: "Password changed successfully" });
  } catch (err: unknown) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// ── PUT /api/auth/reset-password/:userId ──────────────────────────────────────
// Matches hrms-backend: PUT /api/auth/reset-password/:userId
// Protected: only SUPER_ADMIN, ADMIN, HR can reset others' passwords
router.put(
  "/auth/reset-password/:userId",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "HR"),
  async (req, res): Promise<void> => {
    try {
      const userIdParam = Array.isArray(req.params["userId"]) ? req.params["userId"][0] : req.params["userId"];
      const id = parseInt(userIdParam ?? "", 10);
      const { newPassword } = req.body;

      if (isNaN(id)) {
        res.status(400).json({ message: "Invalid user ID" });
        return;
      }

      const rows = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, id));

      if (!rows.length) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await db
        .update(usersTable)
        .set({ password: hashed, updatedAt: new Date() })
        .where(eq(usersTable.id, id));

      res.json({ message: "Password reset successfully" });
    } catch (err: unknown) {
      res.status(500).json({ message: (err as Error).message });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Get current logged-in user's profile
router.get("/auth/me", protect, async (req, res): Promise<void> => {
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
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
        profilePhoto: employeesTable.profilePhoto,
        departmentId: employeesTable.departmentId,
      })
      .from(usersTable)
      .leftJoin(employeesTable, eq(usersTable.employeeId, employeesTable.id))
      .where(eq(usersTable.id, req.user!.userId));

    const user = rows[0];
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhoto: user.profilePhoto,
      departmentId: user.departmentId,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post("/auth/logout", protect, (_req, res): void => {
  // JWT is stateless — client deletes the token
  res.json({ message: "Logged out successfully" });
});

export default router;
