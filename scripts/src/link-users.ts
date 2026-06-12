/**
 * Link existing users to employees that share the same email.
 * Safe to run multiple times.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

console.log("\n🔗  Linking users to employees by email…\n");

// Find users with no employee_id who have an employee with the same email
const toLink = await pool.query(`
  SELECT u.id as user_id, u.name, u.email, e.id as emp_id, e.employee_id as emp_code
  FROM users u
  JOIN employees e ON e.email = u.email
  WHERE u.employee_id IS NULL
`);

console.log(`Found ${toLink.rows.length} users to link:`);
for (const row of toLink.rows) {
  await pool.query(`UPDATE users SET employee_id = $1 WHERE id = $2`, [row.emp_id, row.user_id]);
  console.log(`  ✓  ${row.name} (${row.email}) → employee ${row.emp_code}`);
}

// Also clean up any orphan employees that were partially created (no user, but email has no matching user either)
// Leave those alone — admin can fill them in via directory

console.log("\n✅  Done.\n");
await pool.end();
