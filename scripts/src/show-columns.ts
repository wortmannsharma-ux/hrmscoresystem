import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../.env") });
if (!process.env.DATABASE_URL) config({ path: resolve(__dirname, "../../../artifacts/api-server/.env") });

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const r = await pool.query(`
  SELECT column_name, data_type, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_name='users' 
  ORDER BY ordinal_position
`);
console.log("USERS COLUMNS:");
r.rows.forEach((c: any) => console.log(`  ${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}  default=${c.column_default}`));

const e = await pool.query(`
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_name='employees' 
  ORDER BY ordinal_position
`);
console.log("\nEMPLOYEES COLUMNS:");
e.rows.forEach((c: any) => console.log(`  ${c.column_name}  ${c.data_type}  nullable=${c.is_nullable}`));

await pool.end();
