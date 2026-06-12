/**
 * Startup migration — safely adds missing columns and tables to the database.
 *
 * Every statement uses IF NOT EXISTS / IF NOT COLUMN — safe to run on every
 * startup, whether or not the columns/tables already exist.
 */

import { pool } from "@workspace/db";

async function run(sql: string, label: string): Promise<void> {
  try {
    await pool.query(sql);
    console.log(`[migrate] ✓  ${label}`);
  } catch (err: any) {
    // 42701 = column already exists, 42P07 = relation already exists — safe to ignore
    if (err.code === "42701" || err.code === "42P07") {
      console.log(`[migrate] –  ${label} (already exists, skipped)`);
    } else {
      console.error(`[migrate] ✗  ${label}: ${err.message} (code: ${err.code})`);
      // Don't crash the server — just log and continue
    }
  }
}

export async function runMigrations(): Promise<void> {
  console.log("[migrate] Running startup migrations…");

  // ── users table ─────────────────────────────────────────────────────────────
  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER`,
    "users.employee_id"
  );
  // Add unique index separately (IF NOT EXISTS supported in Postgres 9.5+)
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_employee_id_unique ON users(employee_id) WHERE employee_id IS NOT NULL`,
    "users.employee_id unique index"
  );
  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`,
    "users.last_login_at"
  );
  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
    "users.updated_at"
  );
  await run(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`,
    "users.is_active"
  );

  // ── employees table ──────────────────────────────────────────────────────────
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id INTEGER`,
    "employees.manager_id"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account TEXT`,
    "employees.bank_account"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code TEXT`,
    "employees.ifsc_code"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name TEXT`,
    "employees.bank_name"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pan_number TEXT`,
    "employees.pan_number"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS aadhar_number TEXT`,
    "employees.aadhar_number"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT`,
    "employees.address"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT`,
    "employees.emergency_contact"
  );
  await run(
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_photo TEXT`,
    "employees.profile_photo"
  );

  // ── designations table ───────────────────────────────────────────────────────
  await run(
    `ALTER TABLE designations ADD COLUMN IF NOT EXISTS department_id INTEGER`,
    "designations.department_id"
  );
  await run(
    `ALTER TABLE designations ADD COLUMN IF NOT EXISTS level INTEGER`,
    "designations.level"
  );

  // ── leave_balances table ─────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS leave_balances (
      id           SERIAL PRIMARY KEY,
      employee_id  INTEGER NOT NULL,
      year         INTEGER NOT NULL,
      casual       REAL    NOT NULL DEFAULT 12,
      sick         REAL    NOT NULL DEFAULT 12,
      earned       REAL    NOT NULL DEFAULT 15,
      unpaid       REAL    NOT NULL DEFAULT 999,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (employee_id, year)
    )
  `, "leave_balances table");

  console.log("[migrate] Done.");
}
