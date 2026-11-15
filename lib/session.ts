import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type Session = { uid: number; role: 'admin' | 'teacher'; name: string };

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
    return { uid: Number(payload.uid), role: payload.role as Session['role'], name: String(payload.name) };
  } catch {
    return null;
  }
}

export async function requireRole(role: Session['role']): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== role) redirect(s.role === 'admin' ? '/admin' : '/teacher');
  return s;
}
