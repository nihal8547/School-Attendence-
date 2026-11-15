'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const rows = await q('SELECT id, name, role, password_hash FROM att.users WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) redirect('/login?error=1');
  await createSession({ uid: u.id, role: u.role, name: u.name });
  redirect(u.role === 'admin' ? '/admin' : '/teacher');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
