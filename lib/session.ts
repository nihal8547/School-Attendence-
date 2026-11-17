import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type Session = { uid: number; role: 'superadmin' | 'admin' | 'teacher'; name: string; sid: number };

/** sid = school id (0 for the super admin, who belongs to no school). */
export const homeFor = (role: Session['role']) => (role === 'superadmin' ? '/super' : role === 'admin' ? '/admin' : '/teacher');

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-only-secret');

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(key());
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
    // Older sign-ins (before multi-school) have no sid: they belong to school 1.
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
