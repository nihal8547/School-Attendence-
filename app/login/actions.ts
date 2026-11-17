'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { createSession, destroySession, homeFor } from '@/lib/session';

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const rows = await q('SELECT u.id, u.name, u.role, u.password_hash, u.school_id, s.active AS school_active FROM att.users u LEFT JOIN att.schools s ON s.id = u.school_id WHERE u.email = $1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) redirect('/login?error=1');
  if (u.role !== 'superadmin' && u.school_active === false) redirect('/login?error=suspended');
  await createSession({ uid: u.id, role: u.role, name: u.name, sid: u.school_id ?? 0 });
  redirect(homeFor(u.role));
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
