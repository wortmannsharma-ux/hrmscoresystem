import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = resolve(__dirname, ".env");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
} catch {}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  // Show last 10 users + their linked employee
  const r = await pool.query(`
    SELECT 
      u.id, u.email, u.role, u.employee_id,
      e.employee_id AS emp_code, e.first_name, e.last_name, e.status
    FROM users u 
    LEFT JOIN employees e ON u.employee_id = e.id 
    ORDER BY u.id DESC LIMIT 10
  `);
  console.log("\n=== Last 10 Users + Linked Employees ===");
  console.table(r.rows);

  // Show all employees
  const e = await pool.query(`
    SELECT id, employee_id, first_name, last_name, email, role, status FROM employees ORDER BY id DESC LIMIT 15
  `);
  console.log("\n=== Last 15 Employee Records ===");
  console.table(e.rows);

} catch(err) {
  console.error("Error:", err.message);
} finally {
  await pool.end();
}
