'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { allowClass, backTo, baseFor } from '@/lib/access';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { classHasModule } from '@/lib/modules';
import { getLiveWaStatus } from '@/lib/wa';
import { queueNotices, type Notice } from '@/lib/notify';
import { getSchool } from '@/lib/settings';
import { fmtDate } from '@/lib/format';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function who() {
  const s = await getSession();
  if (!s || s.role === 'superadmin') redirect('/login');
  return s;
}

/** Same checks every time: own school/class, module on for that class. */
async function guard(classId: number, module: string, path: string) {
  const s = await who();
  await allowClass(classId);
  if (!(await classHasModule(classId, module))) backTo(path, 'This module is not enabled for this class.', true);
  return s;
}

async function sender(classId: number, path: string) {
  const [c] = await q<{ name: string; teacher_id: number | null }>(`SELECT name, teacher_id FROM att.classes WHERE id = $1`, [classId]);
  if (!c) backTo(path, 'Class not found', true);
  if (!c.teacher_id) backTo(path, 'This class has no class teacher (WhatsApp sender)', true);
  if ((await getLiveWaStatus(c.teacher_id)) !== 'connected') backTo(path, "The class teacher's WhatsApp is not connected. Connect it under My WhatsApp first.", true);
  return c;
}

async function parentsOf(studentIds: number[] | null, classId: number) {
  return q<{ student_id: number; phone: string }>(
    `SELECT DISTINCT g.student_id, g.phone FROM att.guardians g JOIN att.students s ON s.id = g.student_id AND s.active
     WHERE s.class_id = $1 AND g.opt_in AND ($2::int[] IS NULL OR s.id = ANY($2::int[]))`,
    [classId, studentIds]
  );
}

/* ------------------------------ Homework ------------------------------ */
export async function addHomework(formData: FormData) {
  await ensureSchema();
  const classId = Number(formData.get('class_id'));
  const base = baseFor((await who()).role);
  const path = `${base}/homework?class=${classId}`;
  const s = await guard(classId, 'homework', path);
  const subject = String(formData.get('subject') || '').trim().slice(0, 60);
  const title = String(formData.get('title') || '').trim().slice(0, 120);
  const details = String(formData.get('details') || '').trim().slice(0, 1000);
  const due = String(formData.get('due_date') || '');
  if (!subject || !title) backTo(path, 'Subject and title are required', true);
  if (due && !ISO.test(due)) backTo(path, 'Invalid due date', true);
  const notify = formData.get('notify') === 'on';
  let c: { name: string } | null = null;
  if (notify) c = await sender(classId, path);

  const [hw] = await q<{ id: number }>(
    `INSERT INTO att.homework (class_id, subject, title, details, due_date, created_by) VALUES ($1,$2,$3,$4,NULLIF($5,'')::date,$6) RETURNING id`,
    [classId, subject, title, details, due, s.uid]
  );
  revalidatePath(path);
  if (!notify || !c) backTo(path, 'Homework added');
  const text = `📚 *Homework – ${subject}*\n\n*${title}*${details ? `\n${details}` : ''}${due ? `\n\nDue: ${fmtDate(due)}` : ''}\n\n– Class Teacher, ${c.name}`;
  const targets = await parentsOf(null, classId);
  if (!targets.length) backTo(path, 'Homework added, but there are no parent numbers to send to', true);
  const r = await queueNotices('homework', targets.map((t): Notice => ({ classId, studentId: t.student_id, phone: t.phone, text, refId: hw.id })));
  backTo(path, r.ok ? `Homework added and being sent to ${r.count} parent number(s)` : 'Homework added, but the WhatsApp sender could not be started', !r.ok);
}

export async function deleteHomework(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const [h] = await q<{ class_id: number }>(`SELECT class_id FROM att.homework WHERE id = $1`, [id]);
  const base = baseFor((await who()).role);
  if (!h) backTo(`${base}/homework`, 'Not found', true);
  const path = `${base}/homework?class=${h.class_id}`;
  await guard(h.class_id, 'homework', path);
  await q(`DELETE FROM att.homework WHERE id = $1`, [id]);
  revalidatePath(path);
  backTo(path, 'Homework removed');
}

/* ------------------------------ Syllabus ------------------------------ */
export async function addChapters(formData: FormData) {
  await ensureSchema();
  const classId = Number(formData.get('class_id'));
  const base = baseFor((await who()).role);
  const path = `${base}/syllabus?class=${classId}`;
  await guard(classId, 'syllabus', path);
  const subject = String(formData.get('subject') || '').trim().slice(0, 60);
  const lines = String(formData.get('chapters') || '').split(/\r?\n/).map((l) => l.trim().slice(0, 120)).filter(Boolean).slice(0, 100);
  if (!subject || !lines.length) backTo(path, 'Subject and at least one chapter are required', true);
  await q(
    `INSERT INTO att.syllabus_topics (class_id, subject, chapter, position)
     SELECT $1, $2, x.ch, COALESCE((SELECT MAX(position) FROM att.syllabus_topics WHERE class_id = $1 AND subject = $2), 0) + x.n
     FROM unnest($3::text[]) WITH ORDINALITY AS x(ch, n)`,
    [classId, subject, lines]
  );
  revalidatePath(path);
  backTo(path, `${lines.length} chapter(s) added to ${subject}`);
}

export async function setTopicStatus(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const status = ['pending', 'in_progress', 'done'].includes(String(formData.get('status'))) ? String(formData.get('status')) : 'pending';
  const [t] = await q<{ class_id: number }>(`SELECT class_id FROM att.syllabus_topics WHERE id = $1`, [id]);
  const base = baseFor((await who()).role);
  if (!t) backTo(`${base}/syllabus`, 'Not found', true);
  const path = `${base}/syllabus?class=${t.class_id}`;
  await guard(t.class_id, 'syllabus', path);
  await q(`UPDATE att.syllabus_topics SET status = $2, completed_on = CASE WHEN $2 = 'done' THEN (now() AT TIME ZONE 'Asia/Kolkata')::date ELSE NULL END WHERE id = $1`, [id, status]);
  revalidatePath(path);
  redirect(path);
}

export async function deleteTopic(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const [t] = await q<{ class_id: number }>(`SELECT class_id FROM att.syllabus_topics WHERE id = $1`, [id]);
  const base = baseFor((await who()).role);
  if (!t) backTo(`${base}/syllabus`, 'Not found', true);
  const path = `${base}/syllabus?class=${t.class_id}`;
  await guard(t.class_id, 'syllabus', path);
  await q(`DELETE FROM att.syllabus_topics WHERE id = $1`, [id]);
  revalidatePath(path);
  redirect(path);
}

/* ------------------------------ Leave requests ------------------------------ */
async function studentClass(studentId: number): Promise<number | null> {
  const [r] = await q<{ class_id: number }>(`SELECT class_id FROM att.students WHERE id = $1 AND active`, [studentId]);
  return r?.class_id ?? null;
}

export async function addLeave(formData: FormData) {
  await ensureSchema();
  const classId = Number(formData.get('class_id'));
  const base = baseFor((await who()).role);
  const path = `${base}/leaves?class=${classId}`;
  const s = await guard(classId, 'leaves', path);
  const studentId = Number(formData.get('student_id'));
  const from = String(formData.get('from_date') || '');
  const to = String(formData.get('to_date') || '') || from;
  const reason = String(formData.get('reason') || '').trim().slice(0, 300);
  if ((await studentClass(studentId)) !== classId) backTo(path, 'Choose a student from this class', true);
  if (!ISO.test(from) || !ISO.test(to) || to < from) backTo(path, 'Choose a valid date (or date range)', true);
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 60) backTo(path, 'A leave can be at most 60 days', true);
  await q(`INSERT INTO att.leave_requests (student_id, from_date, to_date, reason, created_by) VALUES ($1,$2::date,$3::date,$4,$5)`, [studentId, from, to, reason, s.uid]);
  revalidatePath(path);
  backTo(path, 'Leave request recorded. Approve or reject it below.');
}

export async function decideLeave(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const decision = formData.get('decision') === 'approved' ? 'approved' : 'rejected';
  const base = baseFor((await who()).role);
  const [l] = await q<{ student_id: number; class_id: number; student: string; f: string; t: string }>(
    `SELECT l.student_id, s.class_id, s.name AS student, to_char(l.from_date,'YYYY-MM-DD') AS f, to_char(l.to_date,'YYYY-MM-DD') AS t
     FROM att.leave_requests l JOIN att.students s ON s.id = l.student_id WHERE l.id = $1`,
    [id]
  );
  if (!l) backTo(`${base}/leaves`, 'Not found', true);
  const path = `${base}/leaves?class=${l.class_id}`;
  const s = await guard(l.class_id, 'leaves', path);
  await q(`UPDATE att.leave_requests SET status = $2, decided_by = $3, decided_at = now() WHERE id = $1`, [id, decision, s.uid]);
  revalidatePath(path);
  if (formData.get('notify') !== 'on') backTo(path, `Leave ${decision}`);
  const c = await sender(l.class_id, path);
  const when = l.f === l.t ? fmtDate(l.f) : `${fmtDate(l.f)} to ${fmtDate(l.t)}`;
  const text = `📝 *Leave ${decision === 'approved' ? 'Approved' : 'Not Approved'}*\n\nThe leave request for *${l.student}* (${when}) has been *${decision.toUpperCase()}*.\n\n– Class Teacher, ${c.name}`;
  const targets = await parentsOf([l.student_id], l.class_id);
  const r = await queueNotices('leave', targets.map((t): Notice => ({ classId: l.class_id, studentId: t.student_id, phone: t.phone, text, refId: id })));
  backTo(path, r.ok ? `Leave ${decision}. Parent is being informed on WhatsApp.` : `Leave ${decision}, but the WhatsApp sender could not be started`, !r.ok);
}

export async function deleteLeave(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const [l] = await q<{ class_id: number }>(`SELECT s.class_id FROM att.leave_requests l JOIN att.students s ON s.id = l.student_id WHERE l.id = $1`, [id]);
  const base = baseFor((await who()).role);
  if (!l) backTo(`${base}/leaves`, 'Not found', true);
  const path = `${base}/leaves?class=${l.class_id}`;
  await guard(l.class_id, 'leaves', path);
  await q(`DELETE FROM att.leave_requests WHERE id = $1`, [id]);
  revalidatePath(path);
  backTo(path, 'Leave request removed');
}

/* ------------------------------ Remarks ------------------------------ */
export async function addRemark(formData: FormData) {
  await ensureSchema();
  const classId = Number(formData.get('class_id'));
  const base = baseFor((await who()).role);
  const path = `${base}/remarks?class=${classId}`;
  const s = await guard(classId, 'remarks', path);
  const studentId = Number(formData.get('student_id'));
  const kind = ['achievement', 'behavior', 'general'].includes(String(formData.get('kind'))) ? String(formData.get('kind')) : 'general';
  const note = String(formData.get('note') || '').trim().slice(0, 500);
  if (!note) backTo(path, 'Write the remark', true);
  if ((await studentClass(studentId)) !== classId) backTo(path, 'Choose a student from this class', true);
  const notify = formData.get('notify') === 'on';
  let c: { name: string } | null = null;
  if (notify) c = await sender(classId, path);
  const [rm] = await q<{ id: number }>(`INSERT INTO att.student_remarks (student_id, kind, note, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [studentId, kind, note, s.uid]);
  revalidatePath(path);
  if (!notify || !c) backTo(path, 'Remark saved');
  const [st] = await q<{ name: string }>(`SELECT name FROM att.students WHERE id = $1`, [studentId]);
  const icon = kind === 'achievement' ? '🏆' : kind === 'behavior' ? '📌' : '📝';
  const title = kind === 'achievement' ? 'Achievement' : kind === 'behavior' ? 'Behaviour note' : 'Teacher remark';
  const school = await getSchool(s.sid);
  const text = `${icon} *${title}*\n\nStudent: *${st.name}*\n${note}\n\n– Class Teacher, ${c.name}, ${school.name}`;
  const targets = await parentsOf([studentId], classId);
  if (!targets.length) backTo(path, 'Remark saved, but there is no parent number to send to', true);
  const r = await queueNotices('remark', targets.map((t): Notice => ({ classId, studentId: t.student_id, phone: t.phone, text, refId: rm.id })));
  backTo(path, r.ok ? 'Remark saved and sent to the parent on WhatsApp' : 'Remark saved, but the WhatsApp sender could not be started', !r.ok);
}

export async function deleteRemark(formData: FormData) {
  await ensureSchema();
  const id = Number(formData.get('id'));
  const [r] = await q<{ class_id: number }>(`SELECT s.class_id FROM att.student_remarks r JOIN att.students s ON s.id = r.student_id WHERE r.id = $1`, [id]);
  const base = baseFor((await who()).role);
  if (!r) backTo(`${base}/remarks`, 'Not found', true);
  const path = `${base}/remarks?class=${r.class_id}`;
  await guard(r.class_id, 'remarks', path);
  await q(`DELETE FROM att.student_remarks WHERE id = $1`, [id]);
  revalidatePath(path);
  backTo(path, 'Remark removed');
}
