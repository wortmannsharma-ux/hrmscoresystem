import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

// ── Roles — exactly matching hrms-backend ────────────────────────────────────
export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "HR",
  "MANAGER",
  "TEAM_LEADER",
  "EMPLOYEE",
  "INTERN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ── Role hierarchy — higher index = higher authority ─────────────────────────
const ROLE_LEVEL: Record<UserRole, number> = {
  INTERN:       1,
  EMPLOYEE:     2,
  TEAM_LEADER:  3,
  MANAGER:      4,
  HR:           5,
  ADMIN:        6,
  SUPER_ADMIN:  7,
};

export interface AuthPayload {
  id: string;          // stringified DB id (jwt compat)
  userId: number;      // numeric id for DB queries
  employeeId: number | null;
  email: string;
  role: UserRole;
  name?: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

// ── protect ───────────────────────────────────────────────────────────────────
// Verifies JWT, attaches decoded user to req.user
// Named `protect` matching hrms-backend convention
export function protect(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Token expired. Please log in again." });
    } else {
      res.status(401).json({ message: "Invalid token" });
    }
  }
}

// ── authorize ─────────────────────────────────────────────────────────────────
// Role whitelist guard — usage: authorize("SUPER_ADMIN", "HR", "ADMIN")
// Named `authorize` matching hrms-backend convention
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "No token provided" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        message: "Access Denied",
        required: roles,
        yourRole: req.user.role,
      });
      return;
    }
    next();
  };
}

// ── authorizeMinLevel ─────────────────────────────────────────────────────────
// Level-based guard — allows the given role AND everything above it
// e.g. authorizeMinLevel("MANAGER") → MANAGER, HR, ADMIN, SUPER_ADMIN all pass
export function authorizeMinLevel(minRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "No token provided" });
      return;
    }
    const userLevel = ROLE_LEVEL[req.user.role] ?? 0;
    const required = ROLE_LEVEL[minRole];
    if (userLevel < required) {
      res.status(403).json({
        message: "Access Denied",
        minimumRequired: minRole,
        yourRole: req.user.role,
      });
      return;
    }
    next();
  };
}

// ── ownerOrAuthorize ──────────────────────────────────────────────────────────
// Passes if the requesting user owns the resource (employeeId matches) OR
// has one of the specified admin roles.
// Usage on routes like GET /employees/:id, GET /leaves/:id etc.
export function ownerOrAuthorize(...adminRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "No token provided" });
      return;
    }

    // Admin roles always pass
    if (adminRoles.includes(req.user.role)) {
      next();
      return;
    }

    // Employees can access their own data — match :id or ?employeeId param
    const paramId = parseInt(
      Array.isArray(req.params["id"]) ? req.params["id"][0] : req.params["id"] ?? req.params["employeeId"] ?? "",
      10,
    );
    const queryEmployeeIdRaw = req.query["employeeId"];
    const queryEmployeeId =
      typeof queryEmployeeIdRaw === "string"
        ? queryEmployeeIdRaw
        : Array.isArray(queryEmployeeIdRaw) && typeof queryEmployeeIdRaw[0] === "string"
        ? queryEmployeeIdRaw[0]
        : "";
    const queryEmpId = parseInt(queryEmployeeId, 10);
    const targetId = !isNaN(paramId) ? paramId : !isNaN(queryEmpId) ? queryEmpId : null;

    if (targetId !== null && req.user.employeeId === targetId) {
      next();
      return;
    }

    res.status(403).json({ message: "Access Denied" });
  };
}

// ── Aliases for backward compatibility ───────────────────────────────────────
export const requireAuth = protect;
export const requireRole = authorize;

// ── signToken ─────────────────────────────────────────────────────────────────
export function signToken(payload: Omit<AuthPayload, "id"> & { id: number }): string {
  const expiresIn = process.env["JWT_EXPIRES_IN"] ?? "1d";
  return jwt.sign(
    {
      id: String(payload.id),
      userId: payload.id,
      employeeId: payload.employeeId,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    },
    getJwtSecret(),
    { expiresIn } as jwt.SignOptions
  );
}
