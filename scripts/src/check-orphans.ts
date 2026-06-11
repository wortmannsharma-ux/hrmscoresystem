import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Employees that have no linked user (orphan employees)
const orphans = await pool.query(`
  SELECT e.id, e.employee_id, e.first_name, e.last_name, e.email, e.role
  FROM employees e
  LEFT JOIN users u ON u.employee_id = e.id
  WHERE u.id IS NULL
  ORDER BY e.id
`);
console.log("ORPHAN EMPLOYEES (no linked user):");
console.table(orphans.rows);

// Users with no linked employee
const unlinked = await pool.query(`
  SELECT u.id, u.user_id, u.name, u.email, u.role, u.employee_id
  FROM users u
  WHERE u.employee_id IS NULL AND u.role NOT IN ('SUPER_ADMIN','ADMIN')
`);
console.log("\nUSERS WITH NO LINKED EMPLOYEE (non-admin):");
console.table(unlinked.rows);

await pool.end();
