import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const users = await pool.query(`
  SELECT u.id, u.email, u.role, u.employee_id, e.employee_id as emp_code, e.status
  FROM users u LEFT JOIN employees e ON u.employee_id = e.id ORDER BY u.id DESC LIMIT 10
`);
console.log("\n=== Last 10 Users (+ linked employee) ===");
console.table(users.rows);

const emps = await pool.query(`
  SELECT id, employee_id, email, role, status FROM employees ORDER BY id DESC LIMIT 10
`);
console.log("=== Last 10 Employees ===");
console.table(emps.rows);

pool.end();
