import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
import { currentSession } from '../ctx.js';
import { redirect } from '../compat.js';

export type Session = { uid: number; role: 'superadmin' | 'admin' | 'teacher'; name: string; sid: number };

/** sid = school id (0 for the super admin, who belongs to no school). */
export const homeFor = (role: Session['role']) => (role === 'superadmin' ? '/super' : role === 'admin' ? '/admin' : '/teacher');

const key = () => new TextEncoder().encode(config.sessionSecret);

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('12h').sign(key());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    const role = payload.role as Session['role'];
    const sid = role === 'superadmin' ? 0 : Number(payload.sid) || 1;
    return { uid: Number(payload.uid), role, name: String(payload.name), sid };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return currentSession();
}

export async function requireRole(role: Session['role']): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== role) redirect(homeFor(s.role));
  return s;
}
