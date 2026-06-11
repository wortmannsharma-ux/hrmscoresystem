import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Check constraints on users table
const c = await pool.query(`
  SELECT conname, contype, pg_get_constraintdef(oid) as def
  FROM pg_constraint 
  WHERE conrelid = 'users'::regclass
  ORDER BY contype
`);
console.log("USERS CONSTRAINTS:");
c.rows.forEach((r: any) => console.log(`  [${r.contype}] ${r.conname}: ${r.def}`));

// Try a direct insert to see the real error
try {
  const r = await pool.query(`
    INSERT INTO users (user_id, name, email, password, role, is_active) 
    VALUES ('TEST99', 'Test User', 'test99@test.com', 'hash', 'EMPLOYEE', true)
    RETURNING id, user_id, name, email, role, is_active, created_at
  `);
  console.log("\nTEST INSERT succeeded:", r.rows[0]);
  // Rollback
  await pool.query("DELETE FROM users WHERE user_id = 'TEST99'");
  console.log("Test row cleaned up");
} catch (err: any) {
  console.log("\nTEST INSERT FAILED:", err.message, "| code:", err.code, "| detail:", err.detail);
}

await pool.end();
