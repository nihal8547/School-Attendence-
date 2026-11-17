import { redirect } from '../compat.js';
import { q } from './db.js';
import type { Session } from './session.js';

/**
 * Modules a Super Admin can switch on/off per school (school-level), and the school admin can then
 * switch on/off per class group (group-level, only the ones with `group: true`). A module with no
 * saved choice is ON. Attendance itself is always on.
 */
export const MODULES = [
  { key: 'timetable', label: 'Timetable', group: true, desc: 'Weekly timetable, print & send to parents' },
  { key: 'marks', label: 'Mark Sheets', group: true, desc: 'Exams, marks entry, results, send to parents' },
  { key: 'reportcards', label: 'Report Card PDF', group: true, desc: 'Report card PDFs and WhatsApp delivery' },
  { key: 'fees', label: 'Fees', group: true, desc: 'Fee items, payments, receipts, reminders' },
  { key: 'homework', label: 'Homework', group: true, desc: 'Daily homework / assignments, notify parents' },
  { key: 'syllabus', label: 'Syllabus & Lesson Plan', group: true, desc: 'Chapters per subject and progress tracking' },
  { key: 'leaves', label: 'Leave Requests', group: true, desc: 'Record, approve or reject student leave' },
  { key: 'remarks', label: 'Remarks & Achievements', group: true, desc: 'Behaviour notes and achievements, notify parents' },
  { key: 'announcements', label: 'Announcements', group: false, desc: 'Notices to parents on WhatsApp' },
  { key: 'holidays', label: 'Holiday Calendar', group: false, desc: 'Holidays; attendance blocked on holidays' },
  { key: 'reports', label: 'Reports & Export', group: false, desc: 'Attendance reports, CSV export' },
] as const;
export type ModuleKey = (typeof MODULES)[number]['key'];
export const GROUP_MODULES = MODULES.filter((m) => m.group);

/** Modules switched OFF for a school. */
async function schoolOff(schoolId: number): Promise<Set<string>> {
  const rows = await q<{ module_key: string }>(`SELECT module_key FROM att.school_modules WHERE school_id = $1 AND NOT enabled`, [schoolId]);
  return new Set(rows.map((r) => r.module_key));
}

export async function schoolHas(schoolId: number, key: string): Promise<boolean> {
  return !(await schoolOff(schoolId)).has(key);
}

/** Classes (id, name) the person may use for a module: school switch ON and class group switch not OFF. */
export async function classesForModule(s: Session, key: ModuleKey): Promise<{ id: number; name: string }[]> {
  if (!(await schoolHas(s.sid, key))) return [];
  return q(
    `SELECT c.id, c.name FROM att.classes c
     LEFT JOIN att.class_group_modules gm ON gm.group_id = c.group_id AND gm.module_key = $2
     WHERE c.school_id = $1 AND gm.enabled IS NOT FALSE AND ($3::int IS NULL OR c.teacher_id = $3)
     ORDER BY c.name`,
    [s.sid, key, s.role === 'teacher' ? s.uid : null]
  );
}

/** Send the person home with a message when the whole module is off for their school. */
export async function requireModule(s: Session, key: ModuleKey, home: string) {
  if (!(await schoolHas(s.sid, key))) {
    redirect(`${home}?err=${encodeURIComponent('This module is not enabled for your school.')}`);
  }
}

/** Module keys to show in the menu. */
export async function navModules(s: Session): Promise<string[]> {
  if (s.role === 'superadmin') return [];
  const off = await schoolOff(s.sid);
  const keys: string[] = MODULES.map((m) => m.key).filter((k) => !off.has(k));
  if (s.role === 'admin') return keys;
  // A teacher sees a class-level module only if it is on for at least one of their classes.
  const out: string[] = [];
  for (const k of keys) {
    const m = MODULES.find((x) => x.key === k)!;
    if (!m.group) out.push(k);
    else if ((await classesForModule(s, k as ModuleKey)).length) out.push(k);
  }
  return out;
}

/** Grading rules of the class group a class belongs to (no group = full marks + rank). */
export async function classPolicy(classId: number): Promise<{ grading: 'marks' | 'grades'; showRank: boolean; group: string | null }> {
  const [r] = await q<{ grading: 'marks' | 'grades'; show_rank: boolean; name: string }>(
    `SELECT g.grading, g.show_rank, g.name FROM att.classes c JOIN att.class_groups g ON g.id = c.group_id WHERE c.id = $1`,
    [classId]
  );
  return { grading: r?.grading ?? 'marks', showRank: r?.show_rank ?? true, group: r?.name ?? null };
}

export async function classHasModule(classId: number, key: string): Promise<boolean> {
  const [r] = await q<{ ok: boolean }>(
    `SELECT (NOT EXISTS (SELECT 1 FROM att.school_modules sm WHERE sm.school_id = c.school_id AND sm.module_key = $2 AND NOT sm.enabled)
             AND NOT EXISTS (SELECT 1 FROM att.class_group_modules gm WHERE gm.group_id = c.group_id AND gm.module_key = $2 AND NOT gm.enabled)) AS ok
     FROM att.classes c WHERE c.id = $1`,
    [classId, key]
  );
  return !!r?.ok;
}
