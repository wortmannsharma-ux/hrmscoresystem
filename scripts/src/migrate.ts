/**
 * Direct SQL migration — runs DDL to align DB with Drizzle schema.
 * Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).
 *
 * Run:  pnpm --filter @workspace/scripts migrate
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) {
  config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });
}
if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL not set"); process.exit(1);
}

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run(sql: string, label: string) {
  try {
    await pool.query(sql);
    console.log(`   ✓  ${label}`);
  } catch (e: any) {
    console.error(`   ✗  ${label}: ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log("\n🔧  Running DB migration…\n");

  // ── users table ───────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'EMPLOYEE',
      is_active   BOOLEAN NOT NULL DEFAULT true,
      employee_id INTEGER UNIQUE,
      last_login_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "users table");

  // If old table had password_hash column, rename it
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE users RENAME COLUMN password_hash TO password;
      END IF;
    END $$;
  `);
  console.log("   ✓  users.password column ensured");

  // Add user_id column if missing
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='users' AND column_name='user_id') THEN
        ALTER TABLE users ADD COLUMN user_id TEXT;
        UPDATE users SET user_id = 'USR' || id::text WHERE user_id IS NULL;
        ALTER TABLE users ALTER COLUMN user_id SET NOT NULL;
        ALTER TABLE users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id);
      END IF;
    END $$;
  `);
  console.log("   ✓  users.user_id column ensured");

  // Add missing columns to users if needed
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_name='users' AND column_name='name') THEN
        ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT 'User';
      END IF;
    END $$;
  `);
  console.log("   ✓  users.name column ensured");

  // ── departments ───────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS departments (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      head_id     INTEGER,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "departments table");

  // ── designations ─────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS designations (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      department_id INTEGER,
      level         INTEGER,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "designations table");

  // ── employees ─────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      id                SERIAL PRIMARY KEY,
      employee_id       TEXT NOT NULL UNIQUE,
      first_name        TEXT NOT NULL,
      last_name         TEXT NOT NULL,
      email             TEXT NOT NULL UNIQUE,
      phone             TEXT NOT NULL,
      role              TEXT NOT NULL DEFAULT 'Desk Employee',
      status            TEXT NOT NULL DEFAULT 'active',
      joining_date      DATE NOT NULL,
      department_id     INTEGER,
      designation_id    INTEGER,
      manager_id        INTEGER,
      bank_account      TEXT,
      ifsc_code         TEXT,
      bank_name         TEXT,
      pan_number        TEXT,
      aadhar_number     TEXT,
      address           TEXT,
      emergency_contact TEXT,
      profile_photo     TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "employees table");

  // ── attendance ────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id                 SERIAL PRIMARY KEY,
      employee_id        INTEGER NOT NULL,
      date               TEXT NOT NULL,
      status             TEXT NOT NULL DEFAULT 'Present',
      check_in_time      TIMESTAMPTZ,
      check_out_time     TIMESTAMPTZ,
      check_in_lat       DOUBLE PRECISION,
      check_in_lng       DOUBLE PRECISION,
      check_in_selfie    TEXT,
      working_hours      DOUBLE PRECISION,
      distance_travelled DOUBLE PRECISION,
      approval_status    TEXT,
      approved_by        INTEGER,
      remarks            TEXT,
      eod_submitted      BOOLEAN DEFAULT false,
      eod_visits         INTEGER,
      eod_km             DOUBLE PRECISION,
      eod_leads          INTEGER,
      eod_orders         INTEGER,
      eod_collection     DOUBLE PRECISION,
      eod_remarks        TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "attendance table");

  // ── attendance_settings ───────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS attendance_settings (
      id                    SERIAL PRIMARY KEY,
      present_before_mins   INTEGER NOT NULL DEFAULT 570,
      late_before_mins      INTEGER NOT NULL DEFAULT 660,
      half_day_before_mins  INTEGER NOT NULL DEFAULT 780,
      geo_fencing_enabled   BOOLEAN NOT NULL DEFAULT false,
      outside_radius_action TEXT NOT NULL DEFAULT 'warn',
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "attendance_settings table");

  // ── leaves ────────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS leaves (
      id               SERIAL PRIMARY KEY,
      employee_id      INTEGER NOT NULL,
      leave_type       TEXT NOT NULL,
      from_date        TEXT NOT NULL,
      to_date          TEXT NOT NULL,
      days             INTEGER,
      reason           TEXT,
      status           TEXT NOT NULL DEFAULT 'Pending',
      manager_approval TEXT,
      hr_approval      TEXT,
      approved_by      INTEGER,
      rejection_reason TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "leaves table");

  // ── holidays ──────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      date        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'National',
      is_optional BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "holidays table");

  // ── expenses ──────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id               SERIAL PRIMARY KEY,
      employee_id      INTEGER NOT NULL,
      category         TEXT NOT NULL,
      amount           DOUBLE PRECISION NOT NULL,
      date             TEXT NOT NULL,
      description      TEXT,
      bill_photo       TEXT,
      status           TEXT NOT NULL DEFAULT 'Pending',
      manager_approval TEXT,
      accounts_approval TEXT,
      is_auto_travel   BOOLEAN DEFAULT false,
      travel_km        DOUBLE PRECISION,
      travel_rate      DOUBLE PRECISION,
      approved_by      INTEGER,
      rejection_reason TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "expenses table");

  // ── payroll ───────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS payroll (
      id                SERIAL PRIMARY KEY,
      employee_id       INTEGER NOT NULL,
      month             TEXT NOT NULL,
      present_days      DOUBLE PRECISION DEFAULT 0,
      half_days         DOUBLE PRECISION DEFAULT 0,
      lop_days          DOUBLE PRECISION DEFAULT 0,
      basic             DOUBLE PRECISION DEFAULT 0,
      hra               DOUBLE PRECISION DEFAULT 0,
      special_allowance DOUBLE PRECISION DEFAULT 0,
      conveyance        DOUBLE PRECISION DEFAULT 0,
      bonus             DOUBLE PRECISION DEFAULT 0,
      incentives        DOUBLE PRECISION DEFAULT 0,
      gross_salary      DOUBLE PRECISION DEFAULT 0,
      pf_deduction      DOUBLE PRECISION DEFAULT 0,
      esi_deduction     DOUBLE PRECISION DEFAULT 0,
      tds_deduction     DOUBLE PRECISION DEFAULT 0,
      professional_tax  DOUBLE PRECISION DEFAULT 0,
      total_deductions  DOUBLE PRECISION DEFAULT 0,
      net_salary        DOUBLE PRECISION DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'Draft',
      paid_on           TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "payroll table");

  // ── salary_structures ─────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS salary_structures (
      id                SERIAL PRIMARY KEY,
      employee_id       INTEGER NOT NULL,
      effective_from    TEXT NOT NULL,
      basic             DOUBLE PRECISION NOT NULL DEFAULT 0,
      hra               DOUBLE PRECISION NOT NULL DEFAULT 0,
      special_allowance DOUBLE PRECISION NOT NULL DEFAULT 0,
      conveyance        DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "salary_structures table");

  // ── jobs ──────────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id             SERIAL PRIMARY KEY,
      title          TEXT NOT NULL,
      department_id  INTEGER,
      description    TEXT,
      requirements   TEXT,
      location       TEXT,
      experience_min INTEGER,
      experience_max INTEGER,
      salary_min     DOUBLE PRECISION,
      salary_max     DOUBLE PRECISION,
      status         TEXT NOT NULL DEFAULT 'Open',
      openings       INTEGER NOT NULL DEFAULT 1,
      posted_date    TEXT,
      closing_date   TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "jobs table");

  // ── applicants ────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS applicants (
      id               SERIAL PRIMARY KEY,
      job_id           INTEGER NOT NULL,
      name             TEXT NOT NULL,
      email            TEXT,
      phone            TEXT,
      experience       DOUBLE PRECISION,
      current_ctc      DOUBLE PRECISION,
      expected_ctc     DOUBLE PRECISION,
      notice_period    INTEGER,
      resume_url       TEXT,
      status           TEXT NOT NULL DEFAULT 'Applied',
      source           TEXT,
      interview_date   TEXT,
      interview_notes  TEXT,
      hr_notes         TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "applicants table");

  // ── vendors ───────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      contact_person TEXT,
      mobile         TEXT,
      email          TEXT,
      address        TEXT,
      lat            DOUBLE PRECISION,
      lng            DOUBLE PRECISION,
      radius         DOUBLE PRECISION,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "vendors table");

  // ── visits ────────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS visits (
      id             SERIAL PRIMARY KEY,
      employee_id    INTEGER NOT NULL,
      vendor_id      INTEGER NOT NULL,
      visit_date     TEXT NOT NULL,
      check_in_time  TIMESTAMPTZ,
      selfie_url     TEXT,
      lat            DOUBLE PRECISION,
      lng            DOUBLE PRECISION,
      remarks        TEXT,
      meeting_notes  TEXT,
      order_value    DOUBLE PRECISION,
      next_follow_up TEXT,
      status         TEXT NOT NULL DEFAULT 'Valid',
      invalid_reason TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "visits table");

  // ── office_locations ──────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS office_locations (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      lat              DOUBLE PRECISION NOT NULL,
      lng              DOUBLE PRECISION NOT NULL,
      radius           DOUBLE PRECISION NOT NULL DEFAULT 50,
      require_approval BOOLEAN NOT NULL DEFAULT false,
      is_active        BOOLEAN NOT NULL DEFAULT true,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "office_locations table");

  // ── location_tracks ───────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS location_tracks (
      id          SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      lat         DOUBLE PRECISION NOT NULL,
      lng         DOUBLE PRECISION NOT NULL,
      speed       DOUBLE PRECISION,
      accuracy    DOUBLE PRECISION,
      timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "location_tracks table");

  // ── notifications ─────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      employee_id INTEGER,
      type        TEXT,
      title       TEXT,
      message     TEXT,
      is_read     TEXT NOT NULL DEFAULT 'false',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `, "notifications table");

  console.log("\n✅  All tables ready.\n");
}

main()
  .catch((err) => { console.error("❌  Migration failed:", err.message); process.exit(1); })
  .finally(() => pool.end());
