'use server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { getSession } from '@/lib/session';
import { mustAdmin, baseFor, backTo } from '@/lib/access';
import { normalizeIndianPhone } from '@/lib/phone';
import { setSetting } from '@/lib/settings';

async function me() {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

export async function changePassword(formData: FormData) {
  await ensureSchema();
  const s = await me();
  const path = `${baseFor(s.role)}/account`;
  const current = String(formData.get('current') || '');
  const next = String(formData.get('next') || '');
  const again = String(formData.get('again') || '');
  if (next.length < 8) backTo(path, 'New password must be at least 8 characters', true);
  if (next !== again) backTo(path, 'The two new passwords do not match', true);
  const [u] = await q<{ password_hash: string }>(`SELECT password_hash FROM att.users WHERE id = $1`, [s.uid]);
  if (!u || !(await bcrypt.compare(current, u.password_hash))) backTo(path, 'Current password is wrong', true);
  await q(`UPDATE att.users SET password_hash = $2 WHERE id = $1`, [s.uid, await bcrypt.hash(next, 10)]);
  backTo(path, 'Password changed');
}

export async function updateProfile(formData: FormData) {
  await ensureSchema();
  const s = await me();
  const path = `${baseFor(s.role)}/account`;
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const rawPhone = String(formData.get('phone') || '').trim();
  if (!name) backTo(path, 'Name is required', true);
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizeIndianPhone(rawPhone);
    if (!phone) backTo(path, 'Enter a valid Indian mobile number', true);
  } else if (s.role === 'teacher') {
    backTo(path, 'A teacher needs a WhatsApp number', true);
  }
  await q(`UPDATE att.users SET name = $2, phone = $3 WHERE id = $1`, [s.uid, name, phone]);
  revalidatePath(path);
  backTo(path, 'Profile saved. Sign in again to see the new name everywhere.');
}

export async function saveSchool(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const name = String(formData.get('school_name') || '').trim().slice(0, 100);
  if (!name) backTo('/admin/account', 'School name is required', true);
  await setSetting('school_name', name);
  await setSetting('school_address', String(formData.get('school_address') || '').trim().slice(0, 200));
  backTo('/admin/account', 'School details saved');
}

export async function adminResetPassword(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const id = Number(formData.get('user_id'));
  const pw = String(formData.get('password') || '');
  if (pw.length < 8) backTo('/admin', 'Password must be at least 8 characters', true);
  const r = await q<{ name: string }>(`UPDATE att.users SET password_hash = $2 WHERE id = $1 AND role = 'teacher' RETURNING name`, [id, await bcrypt.hash(pw, 10)]);
  if (!r.length) backTo('/admin', 'Teacher not found', true);
  backTo('/admin', `Password reset for ${r[0].name}`);
}
