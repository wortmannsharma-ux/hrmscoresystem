import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

try {
  const result = await pool.query('SELECT version()');
  console.log('✅ Database connected successfully!');
  console.log('   PostgreSQL:', result.rows[0].version.substring(0, 60));
} catch (err) {
  console.error('❌ Database connection failed:', err.message);
} finally {
  await pool.end();
}
