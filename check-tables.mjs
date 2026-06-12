import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
try {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log("Tables:", r.rows.map(x => x.table_name).join(", ") || "(none)");
  // Also check if users table has correct error
  const e = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position").catch(()=>({rows:[]}));
  console.log("users columns:", e.rows.map(x=>x.column_name).join(", ") || "table not found");
} catch(err) { console.error(err.message); } finally { await pool.end(); }
