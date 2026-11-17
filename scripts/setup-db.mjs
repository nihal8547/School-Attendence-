// Creates schema `att` from db/schema.sql (idempotent). If ADMIN_EMAIL + ADMIN_PASSWORD are set, upserts the admin user.
import fs from 'node:fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
try {
  const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  console.log('Schema att is ready.');
  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (email && password.length >= 8) {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ($1,$2,$3,'admin',1)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [process.env.ADMIN_NAME || 'Admin', email, hash]
    );
    console.log('Admin ready:', email);
  } else {
    console.log('No ADMIN_EMAIL/ADMIN_PASSWORD set, skipping admin creation.');
  }
  const sEmail = (process.env.SUPERADMIN_EMAIL || '').toLowerCase();
  const sPass = process.env.SUPERADMIN_PASSWORD || '';
  if (sEmail && sPass.length >= 8) {
    await pool.query(
      `INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ('Super Admin',$1,$2,'superadmin',NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'superadmin', school_id = NULL`,
      [sEmail, await bcrypt.hash(sPass, 10)]
    );
    console.log('Super admin ready:', sEmail);
  }
} catch (e) {
  console.error('Setup failed:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
