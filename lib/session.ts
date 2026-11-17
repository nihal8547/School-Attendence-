import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type Session = { uid: number; role: 'superadmin' | 'admin' | 'teacher'; name: string; sid: number };

export const homeFor = (role: Session['role']) => (role === 'superadmin' ? '/super' : role === 'admin' ? '/admin' : '/teacher');

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-only-secret');

/** The API signs the token at login; the web app only keeps it in an httpOnly cookie. */
export async function setSessionToken(token: string) {
  (await cookies()).set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  (await cookies()).delete('session');
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const role = payload.role as Session['role'];
    const sid = role === 'superadmin' ? 0 : Number(payload.sid) || 1;
    return { uid: Number(payload.uid), role, name: String(payload.name), sid };
  } catch {
    return null;
  }
}

export async function requireRole(role: Session['role']): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== role) redirect(homeFor(s.role));
  return s;
}
