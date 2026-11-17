import { FormLike } from '../compat.js';
import bcrypt from 'bcryptjs';
import { revalidatePath } from '../compat.js';
import { redirect } from '../compat.js';
import { q } from '../lib/db.js';
import { getSession } from '../lib/session.js';
import { ensureSchema } from '../lib/academic.js';
import { backTo } from '../lib/access.js';
import { MODULES } from '../lib/modules.js';

async function mustSuper() {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'superadmin') redirect('/login');
  return s;
}

export async function createSchool(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const name = String(formData.get('name') || '').trim().slice(0, 100);
  const address = String(formData.get('address') || '').trim().slice(0, 200);
  const adminName = String(formData.get('admin_name') || '').trim().slice(0, 80) || 'Principal';
  const email = String(formData.get('admin_email') || '').trim().toLowerCase();
  const password = String(formData.get('admin_password') || '');
  if (!name) backTo('/super', 'School name is required', true);
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) backTo('/super', 'A valid admin email and an 8+ character password are required', true);
  if ((await q(`SELECT 1 FROM att.users WHERE email = $1`, [email])).length) backTo('/super', 'That admin email is already used', true);
  const [sc] = await q<{ id: number }>(`INSERT INTO att.schools (name, address) VALUES ($1, $2) RETURNING id`, [name, address]);
  await q(`INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ($1,$2,$3,'admin',$4)`, [adminName, email, await bcrypt.hash(password, 10), sc.id]);
  revalidatePath('/super');
  redirect(`/super/${sc.id}?ok=${encodeURIComponent('School created. Choose which modules it can use below.')}`);
}

export async function updateSchool(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const id = Number(formData.get('school_id'));
  const name = String(formData.get('name') || '').trim().slice(0, 100);
  if (!name) backTo(`/super/${id}`, 'School name is required', true);
  await q(`UPDATE att.schools SET name = $2, address = $3 WHERE id = $1`, [id, name, String(formData.get('address') || '').trim().slice(0, 200)]);
  revalidatePath(`/super/${id}`);
  backTo(`/super/${id}`, 'School details saved');
}

export async function setSchoolActive(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const id = Number(formData.get('school_id'));
  const active = formData.get('active') === '1';
  await q(`UPDATE att.schools SET active = $2 WHERE id = $1`, [id, active]);
  revalidatePath('/super');
  backTo(`/super/${id}`, active ? 'School activated' : 'School suspended: its users can no longer sign in');
}

export async function setSchoolModules(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const id = Number(formData.get('school_id'));
  const on = new Set(formData.getAll('module').map(String));
  for (const m of MODULES) {
    await q(
      `INSERT INTO att.school_modules (school_id, module_key, enabled) VALUES ($1,$2,$3)
       ON CONFLICT (school_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [id, m.key, on.has(m.key)]
    );
  }
  revalidatePath(`/super/${id}`);
  backTo(`/super/${id}`, 'Modules saved');
}

export async function addSchoolAdmin(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const id = Number(formData.get('school_id'));
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const name = String(formData.get('name') || '').trim().slice(0, 80) || 'Admin';
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) backTo(`/super/${id}`, 'A valid email and an 8+ character password are required', true);
  try {
    await q(`INSERT INTO att.users (name, email, password_hash, role, school_id) VALUES ($1,$2,$3,'admin',$4)`, [name, email, await bcrypt.hash(password, 10), id]);
  } catch {
    backTo(`/super/${id}`, 'That email is already used', true);
  }
  revalidatePath(`/super/${id}`);
  backTo(`/super/${id}`, `Admin ${email} added`);
}

export async function resetAdminPassword(formData: FormLike) {
  await ensureSchema();
  await mustSuper();
  const id = Number(formData.get('school_id'));
  const pw = String(formData.get('password') || '');
  if (pw.length < 8) backTo(`/super/${id}`, 'Password must be at least 8 characters', true);
  const r = await q(`UPDATE att.users SET password_hash = $3 WHERE id = $1 AND school_id = $2 AND role = 'admin' RETURNING id`, [Number(formData.get('user_id')), id, await bcrypt.hash(pw, 10)]);
  if (!r.length) backTo(`/super/${id}`, 'Admin not found', true);
  backTo(`/super/${id}`, 'Admin password reset');
}
