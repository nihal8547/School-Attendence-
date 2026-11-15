// Usage: ADMIN_EMAIL=you@school.in ADMIN_PASSWORD=secret ADMIN_NAME="Principal" node --env-file=.env.local scripts/seed-admin.mjs
import pg from 'pg';
import bcrypt from 'bcryptjs';

const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = process.env.ADMIN_NAME || 'Admin';
if (!email || password.length < 8) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars).');
  process.exit(1);
}
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const hash = await bcrypt.hash(password, 10);
await pool.query(
  `INSERT INTO att.users (name, email, password_hash, role) VALUES ($1,$2,$3,'admin')
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
  [name, email, hash]
);
console.log('Admin ready:', email);
await pool.end();
