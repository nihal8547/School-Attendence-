'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { setSessionToken, destroySession } from '@/lib/session';

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  let res: Response;
  try {
    res = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(ip ? { 'x-client-ip': ip } : {}) },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
  } catch {
    redirect('/login?error=server');
  }
  const j = await res.json().catch(() => ({}));
  if (res.status === 429) redirect('/login?error=locked');
  if (res.status === 403 && (j.error === 'suspended' || j.error === 'disabled')) redirect('/login?error=suspended');
  if (!res.ok || !j.token) redirect('/login?error=1');
  await setSessionToken(j.token);
  redirect(j.home || '/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
