// One-off setup: applies migrations and (optionally) creates the first school admin and the super admin.
//   ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME           -> admin of school 1
//   SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD              -> super admin
import bcrypt from 'bcryptjs';
import { assertConfig } from './config.js';
import { migrate } from './migrate.js';
import { getPool, closePool } from './db.js';

assertConfig();
await migrate();
console.log('Database schema is ready.');
const pool = getPool();
const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
if (email && password.length >= 8) {
  await pool.query(
    `INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ($1,$2,$3,'admin',1)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [process.env.ADMIN_NAME || 'Admin', email, await bcrypt.hash(password, 10)]
  );
  console.log('Admin ready:', email);
}
const sEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase();
const sPass = process.env.SUPERADMIN_PASSWORD || '';
if (sEmail && sPass.length >= 8) {
  await pool.query(
    `INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ($1,$2,$3,'superadmin',NULL)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin', school_id = NULL`,
    [process.env.SUPERADMIN_NAME || 'Super Admin', sEmail, await bcrypt.hash(sPass, 10)]
  );
  console.log('Super admin ready:', sEmail);
}
await closePool();
