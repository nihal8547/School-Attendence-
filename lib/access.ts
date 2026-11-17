import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';

/** Admin may use any class; a teacher only their own. */
export async function allowClass(classId: number): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role === 'admin') return s;
  const own = await q(`SELECT 1 FROM att.classes WHERE id = $1 AND teacher_id = $2`, [classId, s.uid]);
  if (!own.length) redirect('/login');
  return s;
}

export async function classesFor(s: Session): Promise<{ id: number; name: string }[]> {
  return s.role === 'admin'
    ? q(`SELECT id, name FROM att.classes ORDER BY name`)
    : q(`SELECT id, name FROM att.classes WHERE teacher_id = $1 ORDER BY name`, [s.uid]);
}

export async function mustAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'admin') redirect('/teacher');
  return s;
}

export function baseFor(role: 'admin' | 'teacher') {
  return role === 'admin' ? '/admin' : '/teacher';
}

export function backTo(path: string, msg: string, err = false): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
}
