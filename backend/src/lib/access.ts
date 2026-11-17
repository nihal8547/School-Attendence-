import { redirect } from '../compat.js';
import { q } from './db.js';
import { getSession, homeFor, type Session } from './session.js';

/** Admin may use any class; a teacher only their own. */
export async function allowClass(classId: number): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role === 'admin') {
    const mine = await q(`SELECT 1 FROM att.classes WHERE id = $1 AND school_id = $2`, [classId, s.sid]);
    if (!mine.length) redirect('/admin');
    return s;
  }
  if (s.role !== 'teacher') redirect('/login');
  const own = await q(`SELECT 1 FROM att.classes WHERE id = $1 AND teacher_id = $2`, [classId, s.uid]);
  if (!own.length) redirect('/login');
  return s;
}

export async function classesFor(s: Session): Promise<{ id: number; name: string }[]> {
  return s.role === 'admin'
    ? q(`SELECT id, name FROM att.classes WHERE school_id = $1 ORDER BY name`, [s.sid])
    : q(`SELECT id, name FROM att.classes WHERE teacher_id = $1 ORDER BY name`, [s.uid]);
}

export async function mustAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role !== 'admin') redirect(homeFor(s.role));
  return s;
}

export function baseFor(role: 'superadmin' | 'admin' | 'teacher') {
  return role === 'superadmin' ? '/super' : role === 'admin' ? '/admin' : '/teacher';
}

export function backTo(path: string, msg: string, err = false): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
}

/** Admin only: make sure a fee item / student / teacher belongs to the admin's own school. */
export async function schoolOwns(s: Session, table: 'class' | 'user' | 'student' | 'fee_item', id: number): Promise<boolean> {
  const sql = {
    class: `SELECT 1 FROM att.classes WHERE id = $1 AND school_id = $2`,
    user: `SELECT 1 FROM att.users WHERE id = $1 AND school_id = $2`,
    student: `SELECT 1 FROM att.students st JOIN att.classes c ON c.id = st.class_id WHERE st.id = $1 AND c.school_id = $2`,
    fee_item: `SELECT 1 FROM att.fee_items fi JOIN att.classes c ON c.id = fi.class_id WHERE fi.id = $1 AND c.school_id = $2`,
  }[table];
  return (await q(sql, [id, s.sid])).length > 0;
}
