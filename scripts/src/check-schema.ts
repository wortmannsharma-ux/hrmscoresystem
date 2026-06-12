import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const tables = await pool.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name
`);
console.log("\nTables:", tables.rows.map((r: any) => r.table_name).join(", "));

const cols = await pool.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'users' ORDER BY ordinal_position
`);
console.log("\nusers columns:");
cols.rows.forEach((r: any) => console.log(`  ${r.column_name}  (${r.data_type})`));

await pool.end();
