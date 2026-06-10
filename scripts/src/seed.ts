/**
 * HRMS Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates login users + sample org data so you can immediately sign in.
 *
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────────────────────────
 *  The app has TWO separate tables:
 *
 *  ┌──────────┐         ┌───────────┐
 *  │  users   │────────▶│ employees │
 *  │ (login)  │ (opt.)  │ (HR data) │
 *  └──────────┘         └───────────┘
 *
 *  • `users`     – who can LOG IN. Has email + password + role.
 *  • `employees` – HR profile (salary, department, bank details…).
 *  • A user can optionally be LINKED to an employee row via `employee_id`.
 *    SUPER_ADMIN doesn't need a linked employee (it's a system account).
 *    HR/MANAGER users should be linked to their employee record so the
 *    app can show their name, department, etc.
 *
 * RUN (from workspace root)
 * ─────────────────────────────────────────────────────────────────────────────
 *   pnpm --filter @workspace/scripts seed
 *
 * or directly:
 *   cd scripts && npx tsx --env-file=../.env src/seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Load DATABASE_URL from .env before importing @workspace/db
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// Try ../../.env (scripts/src → workspace root)
config({ path: resolve(__dirname, "../../.env") });
// Fallback: api-server env
if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });
}

if (!process.env.DATABASE_URL) {
  console.error("\n❌  DATABASE_URL is not set. Make sure .env exists at the workspace root.\n");
  process.exit(1);
}

import bcrypt from "bcryptjs";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ── upsert helpers (raw SQL — avoids drizzle error wrapping) ──────────────────

async function upsertUser(data: {
  userId: string;
  name: string;
  email: string;
  password: string;
  role: string;
}): Promise<number> {
  const hash = await bcrypt.hash(data.password, 10);

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [data.email]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      "UPDATE users SET password = $1, role = $2, is_active = true WHERE email = $3",
      [hash, data.role, data.email]
    );
    console.log(`   ↻  Updated user  : ${data.email}  (${data.role})`);
    return existing.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO users (user_id, name, email, password, role, is_active)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [data.userId, data.name, data.email, hash, data.role]
  );

  console.log(`   ✓  Created user  : ${data.email}  (${data.role})`);
  return result.rows[0].id;
}

async function upsertDepartment(name: string, description: string): Promise<number> {
  const existing = await pool.query("SELECT id FROM departments WHERE name = $1", [name]);
  if (existing.rows.length > 0) {
    console.log(`   –  Exists dept   : ${name}`);
    return existing.rows[0].id;
  }
  const result = await pool.query(
    "INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING id",
    [name, description]
  );
  console.log(`   ✓  Created dept  : ${name}`);
  return result.rows[0].id;
}

async function upsertDesignation(name: string, departmentId: number, level: number): Promise<number> {
  const existing = await pool.query("SELECT id FROM designations WHERE name = $1", [name]);
  if (existing.rows.length > 0) {
    console.log(`   –  Exists desig  : ${name}`);
    return existing.rows[0].id;
  }
  const result = await pool.query(
    "INSERT INTO designations (name, department_id, level) VALUES ($1, $2, $3) RETURNING id",
    [name, departmentId, level]
  );
  console.log(`   ✓  Created desig : ${name}`);
  return result.rows[0].id;
}

async function upsertEmployee(data: {
  employeeId: string; firstName: string; lastName: string;
  email: string; phone: string; role: string;
  departmentId: number; designationId: number;
}): Promise<number> {
  const existing = await pool.query("SELECT id FROM employees WHERE email = $1", [data.email]);
  if (existing.rows.length > 0) {
    console.log(`   –  Exists emp    : ${data.firstName} ${data.lastName}`);
    return existing.rows[0].id;
  }
  const today = new Date().toISOString().split("T")[0]!;
  const result = await pool.query(
    `INSERT INTO employees
       (employee_id, first_name, last_name, email, phone, role, status, joining_date, department_id, designation_id)
     VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9) RETURNING id`,
    [data.employeeId, data.firstName, data.lastName, data.email,
     data.phone, data.role, today, data.departmentId, data.designationId]
  );
  console.log(`   ✓  Created emp   : ${data.firstName} ${data.lastName} <${data.email}>`);
  return result.rows[0].id;
}

async function linkEmployeeToUser(userId: number, employeeId: number) {
  await pool.query("UPDATE users SET employee_id = $1 WHERE id = $2", [employeeId, userId]);
  console.log(`   🔗 Linked user #${userId} → employee #${employeeId}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱  HRMS Seed Script");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Login users
  //
  //  These rows go into the `users` table.
  //  The `users` table = WHO CAN LOGIN.
  //  Role controls what they can see/do in the app.
  //
  //  SUPER_ADMIN  → full access, can create/delete anything
  //  ADMIN        → similar to SUPER_ADMIN but can't delete users
  //  HR           → manage employees, leaves, payroll
  //  MANAGER      → view team, approve leaves/expenses
  //  EMPLOYEE     → own profile, own leaves, own attendance
  // ────────────────────────────────────────────────────────────────────────────
  console.log("👤  STEP 1 — Login users (users table)…\n");

  const superAdminUserId = await upsertUser({
    userId: "SA1",
    name: "Super Admin",
    email: "admin@innoven.com",
    password: "Admin@1234",
    role: "SUPER_ADMIN",
  });

  const adminUserId = await upsertUser({
    userId: "ADM1",
    name: "Admin User",
    email: "admin2@innoven.com",
    password: "Admin@1234",
    role: "ADMIN",
  });

  const hrUserId = await upsertUser({
    userId: "HR1",
    name: "Priya Patel",
    email: "hr@innoven.com",
    password: "HR@1234",
    role: "HR",
  });

  const managerUserId = await upsertUser({
    userId: "MGR1",
    name: "Rahul Sharma",
    email: "manager@innoven.com",
    password: "Manager@1234",
    role: "MANAGER",
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Departments
  //
  //  Departments go in the `departments` table.
  //  They are independent of users — purely for org structure.
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n🏢  STEP 2 — Departments…\n");

  const engId   = await upsertDepartment("Engineering",      "Software development & infrastructure");
  const hrId    = await upsertDepartment("Human Resources",  "Talent acquisition & employee relations");
  const salesId = await upsertDepartment("Sales",            "Revenue generation & client management");
  const finId   = await upsertDepartment("Finance",          "Accounting, payroll & financial planning");
  const opsId   = await upsertDepartment("Operations",       "Day-to-day business operations");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Designations (job titles)
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n🏷️   STEP 3 — Designations…\n");

  const ctoId        = await upsertDesignation("CTO",                   engId,   7);
  const senDevId     = await upsertDesignation("Senior Developer",      engId,   5);
  const junDevId     = await upsertDesignation("Junior Developer",      engId,   3);
  const hrMgrId      = await upsertDesignation("HR Manager",            hrId,    6);
  const hrExecId     = await upsertDesignation("HR Executive",          hrId,    3);
  const salesMgrId   = await upsertDesignation("Sales Manager",         salesId, 5);
  const salesExecId  = await upsertDesignation("Sales Executive",       salesId, 3);
  const acctId       = await upsertDesignation("Accountant",            finId,   4);
  const opsExecId    = await upsertDesignation("Operations Executive",  opsId,   3);

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4 — Employees (HR profiles)
  //
  //  The `employees` table stores HR/payroll data for each person.
  //  A login user CAN BE linked to an employee row, but doesn't have to be.
  //
  //  SUPER_ADMIN — typically a system account, no employee row needed.
  //  HR/MANAGER  — they ARE employees, so we create employee rows for them
  //                and then link their user account to the employee row.
  //
  //  This way the app can show "Priya Patel, HR Manager" in the sidebar
  //  and their profile page works correctly.
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n👥  STEP 4 — Employees (HR profiles)…\n");

  // HR Manager employee record (linked to hrUserId)
  const empPriyaId = await upsertEmployee({
    employeeId: "HR-001",
    firstName: "Priya", lastName: "Patel",
    email: "hr@innoven.com",
    phone: "9876543211",
    role: "HR",
    departmentId: hrId,
    designationId: hrMgrId,
  });

  // Engineering Manager (linked to managerUserId)
  const empRahulId = await upsertEmployee({
    employeeId: "ENG-001",
    firstName: "Rahul", lastName: "Sharma",
    email: "manager@innoven.com",
    phone: "9876543210",
    role: "MANAGER",
    departmentId: engId,
    designationId: ctoId,
  });

  // Regular employees (no login accounts by default — HR can add them via app)
  await upsertEmployee({
    employeeId: "ENG-002",
    firstName: "Sneha", lastName: "Gupta",
    email: "sneha.gupta@innoven.com",
    phone: "9876543213",
    role: "EMPLOYEE",
    departmentId: engId,
    designationId: senDevId,
  });

  await upsertEmployee({
    employeeId: "ENG-003",
    firstName: "Karan", lastName: "Verma",
    email: "karan.verma@innoven.com",
    phone: "9876543215",
    role: "EMPLOYEE",
    departmentId: engId,
    designationId: junDevId,
  });

  await upsertEmployee({
    employeeId: "SAL-001",
    firstName: "Arjun", lastName: "Mehta",
    email: "arjun.mehta@innoven.com",
    phone: "9876543212",
    role: "EMPLOYEE",
    departmentId: salesId,
    designationId: salesExecId,
  });

  await upsertEmployee({
    employeeId: "SAL-002",
    firstName: "Neha", lastName: "Joshi",
    email: "neha.joshi@innoven.com",
    phone: "9876543216",
    role: "EMPLOYEE",
    departmentId: salesId,
    designationId: salesExecId,
  });

  await upsertEmployee({
    employeeId: "FIN-001",
    firstName: "Vikram", lastName: "Singh",
    email: "vikram.singh@innoven.com",
    phone: "9876543214",
    role: "EMPLOYEE",
    departmentId: finId,
    designationId: acctId,
  });

  await upsertEmployee({
    employeeId: "OPS-001",
    firstName: "Divya", lastName: "Kapoor",
    email: "divya.kapoor@innoven.com",
    phone: "9876543217",
    role: "EMPLOYEE",
    departmentId: opsId,
    designationId: opsExecId,
  });

  await upsertEmployee({
    employeeId: "HR-002",
    firstName: "Amit", lastName: "Desai",
    email: "amit.desai@innoven.com",
    phone: "9876543218",
    role: "EMPLOYEE",
    departmentId: hrId,
    designationId: hrExecId,
  });

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Link login users to their employee profiles
  //
  //  This connects the login account to the HR record.
  //  After linking, the app will show the user's real name, department,
  //  and profile photo in the sidebar and on their profile page.
  //
  //  SUPER_ADMIN is intentionally NOT linked — it's a system-level account.
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\n🔗  STEP 5 — Linking users to employee profiles…\n");

  await linkEmployeeToUser(hrUserId, empPriyaId);
  await linkEmployeeToUser(managerUserId, empRahulId);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  Seed complete! Here are your login credentials:

  ┌─────────────────────────────────────────────────┐
  │  SUPER ADMIN  (full system access)              │
  │  Email   : admin@innoven.com                    │
  │  Password: Admin@1234                           │
  ├─────────────────────────────────────────────────┤
  │  ADMIN  (management access)                     │
  │  Email   : admin2@innoven.com                   │
  │  Password: Admin@1234                           │
  ├─────────────────────────────────────────────────┤
  │  HR MANAGER  (HR + employee management)         │
  │  Email   : hr@innoven.com                       │
  │  Password: HR@1234                              │
  ├─────────────────────────────────────────────────┤
  │  MANAGER  (team management + approvals)         │
  │  Email   : manager@innoven.com                  │
  │  Password: Manager@1234                         │
  └─────────────────────────────────────────────────┘

  ⚠️  Change all passwords after first login via Settings.

  📝  HOW TO ADD MORE USERS:
      Use POST /api/auth/register with:
      { "name", "email", "password", "role" }
      Roles: SUPER_ADMIN | ADMIN | HR | MANAGER |
             TEAM_LEADER | EMPLOYEE | INTERN

      Then link to an employee via PATCH /api/employees/:id
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((err) => {
    console.error("\n❌  Seed failed:", err.message ?? err);
    if (err.detail) console.error("    Detail:", err.detail);
    if (err.hint)   console.error("    Hint  :", err.hint);
    if (err.code)   console.error("    Code  :", err.code);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
    process.exit(0);
  });
