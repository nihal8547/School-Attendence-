import { q } from '@/lib/db';
import { getSession, type Session } from '@/lib/session';
import { classesFor } from '@/lib/access';
import { todayIST } from '@/lib/n8n';

export type ReportParams = { type: 'students' | 'absentees' | 'classes'; classId: number | null; from: string; to: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseParams(sp: { type?: string; class?: string; from?: string; to?: string }, role: Session['role']): ReportParams {
  const today = todayIST();
  const first = today.slice(0, 8) + '01';
  let from = ISO.test(sp.from || '') ? sp.from! : first;
  let to = ISO.test(sp.to || '') ? sp.to! : today;
  if (to < from) [from, to] = [to, from];
  const lim = new Date(Date.parse(to) - 366 * 86400000).toISOString().slice(0, 10);
  if (from < lim) from = lim;
  const type = sp.type === 'absentees' ? 'absentees' : sp.type === 'classes' && role === 'admin' ? 'classes' : 'students';
  const cid = Number(sp.class);
  return { type, classId: cid > 0 ? cid : null, from, to };
}

/** Class ids this user may report on, narrowed to the chosen class if any. */
export async function scopeClassIds(s: Session, classId: number | null): Promise<number[]> {
  const allowed = (await classesFor(s)).map((c) => c.id);
  if (classId && allowed.includes(classId)) return [classId];
  return allowed;
}

export async function studentSummary(ids: number[], from: string, to: string) {
  return q<{ class_name: string; roll_no: number; name: string; present: string; absent: string; total: string }>(
    `SELECT c.name AS class_name, s.roll_no, s.name,
            COUNT(a.id) FILTER (WHERE a.status = 'P') AS present,
            COUNT(a.id) FILTER (WHERE a.status = 'A') AS absent,
            COUNT(a.id) AS total
     FROM att.students s
     JOIN att.classes c ON c.id = s.class_id
     LEFT JOIN att.attendance a ON a.student_id = s.id AND a.att_date BETWEEN $2::date AND $3::date
     WHERE s.active AND s.class_id = ANY($1::int[])
     GROUP BY c.name, s.roll_no, s.name, s.id ORDER BY c.name, s.roll_no, s.name`,
    [ids, from, to]
  );
}

export async function absenteeList(ids: number[], from: string, to: string) {
  return q<{ d: string; session: string; class_name: string; roll_no: number; name: string; phone: string | null }>(
    `SELECT to_char(a.att_date, 'YYYY-MM-DD') AS d, a.session, c.name AS class_name, s.roll_no, s.name,
            (SELECT g.phone FROM att.guardians g WHERE g.student_id = s.id ORDER BY g.is_primary DESC, g.id LIMIT 1) AS phone
     FROM att.attendance a
     JOIN att.students s ON s.id = a.student_id
     JOIN att.classes c ON c.id = s.class_id
     WHERE a.status = 'A' AND s.class_id = ANY($1::int[]) AND a.att_date BETWEEN $2::date AND $3::date
     ORDER BY a.att_date DESC, c.name, s.roll_no, a.session`,
    [ids, from, to]
  );
}

export async function classComparison(ids: number[], from: string, to: string) {
  return q<{ class_name: string; teacher: string | null; students: string; present: string; absent: string; total: string }>(
    `SELECT c.name AS class_name, u.name AS teacher,
            (SELECT COUNT(*) FROM att.students s WHERE s.class_id = c.id AND s.active) AS students,
            COUNT(a.id) FILTER (WHERE a.status = 'P') AS present,
            COUNT(a.id) FILTER (WHERE a.status = 'A') AS absent,
            COUNT(a.id) AS total
     FROM att.classes c
     LEFT JOIN att.users u ON u.id = c.teacher_id
     LEFT JOIN att.students s ON s.class_id = c.id AND s.active
     LEFT JOIN att.attendance a ON a.student_id = s.id AND a.att_date BETWEEN $2::date AND $3::date
     WHERE c.id = ANY($1::int[])
     GROUP BY c.id, c.name, u.name ORDER BY c.name`,
    [ids, from, to]
  );
}

export async function workingDays(ids: number[], from: string, to: string): Promise<number> {
  const [r] = await q<{ n: string }>(
    `SELECT COUNT(DISTINCT sm.att_date) AS n FROM att.session_marks sm
     WHERE sm.class_id = ANY($1::int[]) AND sm.att_date BETWEEN $2::date AND $3::date`,
    [ids, from, to]
  );
  return Number(r?.n || 0);
}

export const pct = (p: number | string, t: number | string) => (Number(t) ? (Number(p) / Number(t)) * 100 : null);

export async function currentSession() {
  return getSession();
}
