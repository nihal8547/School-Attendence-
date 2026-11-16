'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { getSession } from '@/lib/session';
import { ensureAcademicTables, DAYS, PERIODS, grade } from '@/lib/academic';
import { callN8n } from '@/lib/n8n';
import { getLiveWaStatus } from '@/lib/wa';

function baseOf(formData: FormData) {
  return formData.get('base') === '/admin' ? '/admin' : '/teacher';
}

function back(path: string, msg: string, err = false): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
}

// Admin may touch any class; a teacher only their own.
async function allowClass(classId: number) {
  const s = await getSession();
  if (!s) redirect('/login');
  if (s.role === 'admin') return s;
  const own = await q(`SELECT 1 FROM att.classes WHERE id = $1 AND teacher_id = $2`, [classId, s.uid]);
  if (!own.length) redirect('/login');
  return s;
}

export async function saveTimetable(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const classId = Number(formData.get('class_id'));
  await allowClass(classId);
  const path = `${base}/timetable?class=${classId}`;

  const days: number[] = [];
  const periods: number[] = [];
  const subjects: string[] = [];
  const clearDays: number[] = [];
  const clearPeriods: number[] = [];
  for (let d = 1; d <= DAYS.length; d++) {
    for (const p of PERIODS) {
      const v = String(formData.get(`c_${d}_${p}`) || '').trim().slice(0, 40);
      if (v) {
        days.push(d);
        periods.push(p);
        subjects.push(v);
      } else {
        clearDays.push(d);
        clearPeriods.push(p);
      }
    }
  }
  if (clearDays.length) {
    await q(
      `DELETE FROM att.timetable t USING unnest($2::int[], $3::int[]) AS x(d, p)
       WHERE t.class_id = $1 AND t.day_of_week = x.d AND t.period = x.p`,
      [classId, clearDays, clearPeriods]
    );
  }
  if (days.length) {
    await q(
      `INSERT INTO att.timetable (class_id, day_of_week, period, subject)
       SELECT $1, x.d, x.p, x.s FROM unnest($2::int[], $3::int[], $4::text[]) AS x(d, p, s)
       ON CONFLICT (class_id, day_of_week, period) DO UPDATE SET subject = EXCLUDED.subject`,
      [classId, days, periods, subjects]
    );
  }
  revalidatePath(`${base}/timetable`);
  back(path, 'Timetable saved');
}

export async function createExam(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const classId = Number(formData.get('class_id'));
  await allowClass(classId);
  const path = `${base}/marks?class=${classId}`;

  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const date = String(formData.get('exam_date') || '');
  const maxMarks = Math.max(1, Math.min(1000, Number(formData.get('max_marks')) || 100));
  const subjects = [...new Set(String(formData.get('subjects') || '').split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean))];
  if (!name) back(path, 'Exam name is required', true);
  if (!subjects.length) back(path, 'Add at least one subject (comma separated)', true);
  if (subjects.length > 15) back(path, 'Maximum 15 subjects per exam', true);

  const [exam] = await q<{ id: number }>(
    `INSERT INTO att.exams (class_id, name, exam_date) VALUES ($1, $2, $3) RETURNING id`,
    [classId, name, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null]
  );
  await q(
    `INSERT INTO att.exam_subjects (exam_id, subject, max_marks, position)
     SELECT $1, x.s, $2, x.i FROM unnest($3::text[]) WITH ORDINALITY AS x(s, i)`,
    [exam.id, maxMarks, subjects]
  );
  redirect(`${base}/marks/${exam.id}`);
}

export async function saveMarks(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const examId = Number(formData.get('exam_id'));
  const [exam] = await q<{ class_id: number }>(`SELECT class_id FROM att.exams WHERE id = $1`, [examId]);
  if (!exam) back(`${base}/marks`, 'Exam not found', true);
  await allowClass(exam.class_id);
  const path = `${base}/marks/${examId}`;

  const subs = await q<{ subject: string; max_marks: number }>(`SELECT subject, max_marks FROM att.exam_subjects WHERE exam_id = $1`, [examId]);
  const roster = await q<{ id: number }>(`SELECT id FROM att.students WHERE class_id = $1 AND active`, [exam.class_id]);

  const sIds: number[] = [];
  const subj: string[] = [];
  const vals: number[] = [];
  const delIds: number[] = [];
  const delSubj: string[] = [];
  for (const st of roster) {
    for (const sub of subs) {
      const raw = String(formData.get(`m_${st.id}_${sub.subject}`) ?? '').trim();
      if (raw === '') {
        delIds.push(st.id);
        delSubj.push(sub.subject);
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > sub.max_marks) {
        back(path, `Marks must be between 0 and ${sub.max_marks} (${sub.subject})`, true);
      }
      sIds.push(st.id);
      subj.push(sub.subject);
      vals.push(n);
    }
  }
  if (delIds.length) {
    await q(
      `DELETE FROM att.marks m USING unnest($2::int[], $3::text[]) AS x(sid, sub)
       WHERE m.exam_id = $1 AND m.student_id = x.sid AND m.subject = x.sub`,
      [examId, delIds, delSubj]
    );
  }
  if (sIds.length) {
    await q(
      `INSERT INTO att.marks (exam_id, student_id, subject, marks)
       SELECT $1, x.sid, x.sub, x.v FROM unnest($2::int[], $3::text[], $4::numeric[]) AS x(sid, sub, v)
       ON CONFLICT (exam_id, student_id, subject) DO UPDATE SET marks = EXCLUDED.marks`,
      [examId, sIds, subj, vals]
    );
  }
  revalidatePath(path);
  back(path, 'Marks saved');
}

export async function deleteExam(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const examId = Number(formData.get('exam_id'));
  const [exam] = await q<{ class_id: number }>(`SELECT class_id FROM att.exams WHERE id = $1`, [examId]);
  if (!exam) back(`${base}/marks`, 'Exam not found', true);
  await allowClass(exam.class_id);
  await q(`DELETE FROM att.exams WHERE id = $1`, [examId]);
  revalidatePath(`${base}/marks`);
  back(`${base}/marks?class=${exam.class_id}`, 'Exam deleted');
}

type Notice = { studentId: number | null; phone: string; text: string };

// Stores the messages in att.notice_log, then asks n8n to send that batch from the class teacher's WhatsApp.
async function queueAndSend(kind: 'timetable' | 'marksheet', classId: number, examId: number | null, items: Notice[], path: string, teacherId: number | null) {
  if (!teacherId) back(path, 'This class has no class teacher assigned', true);
  if ((await getLiveWaStatus(teacherId)) !== 'connected') {
    back(path, "The class teacher's WhatsApp is not connected. Connect it under My WhatsApp first.", true);
  }
  if (!items.length) back(path, 'No parents with a WhatsApp number to send to', true);
  const batch = crypto.randomUUID();
  await q(
    `INSERT INTO att.notice_log (batch, kind, class_id, exam_id, student_id, phone, text)
     SELECT $1, $2, $3, $4, x.sid, x.ph, x.tx FROM unnest($5::int[], $6::text[], $7::text[]) AS x(sid, ph, tx)`,
    [batch, kind, classId, examId, items.map((i) => i.studentId), items.map((i) => i.phone), items.map((i) => i.text)]
  );
  const r = await callN8n('send-notices', { batch });
  if (!r.ok) back(path, 'Saved, but the WhatsApp sender (n8n) could not be started. Please try again.', true);
  back(path, `Sending to ${items.length} parent${items.length === 1 ? '' : 's'} on WhatsApp. They are sent one by one, so it can take a few minutes.`);
}

export async function sendTimetable(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const classId = Number(formData.get('class_id'));
  await allowClass(classId);
  const path = `${base}/timetable?class=${classId}`;

  const [cls] = await q<{ name: string; teacher_id: number | null }>(`SELECT name, teacher_id FROM att.classes WHERE id = $1`, [classId]);
  const rows = await q<{ day_of_week: number; period: number; subject: string }>(
    `SELECT day_of_week, period, subject FROM att.timetable WHERE class_id = $1 ORDER BY day_of_week, period`,
    [classId]
  );
  if (!rows.length) back(path, 'Fill in and save the timetable first', true);

  const lines = DAYS.map((d, i) => {
    const day = rows.filter((r) => r.day_of_week === i + 1);
    return day.length ? `*${d}*\n` + day.map((r) => `${r.period}. ${r.subject}`).join('\n') : '';
  }).filter(Boolean);
  const text = `📅 *Class ${cls.name} – Weekly Timetable*\n\n${lines.join('\n\n')}\n\n– Class Teacher, ${cls.name}`;

  const phones = await q<{ phone: string }>(
    `SELECT DISTINCT g.phone FROM att.guardians g JOIN att.students s ON s.id = g.student_id
     WHERE s.class_id = $1 AND s.active AND g.opt_in`,
    [classId]
  );
  await queueAndSend('timetable', classId, null, phones.map((p) => ({ studentId: null, phone: p.phone, text })), path, cls.teacher_id);
}

export async function sendMarksheet(formData: FormData) {
  await ensureAcademicTables();
  const base = baseOf(formData);
  const examId = Number(formData.get('exam_id'));
  const [exam] = await q<{ id: number; name: string; class_id: number; class_name: string; teacher_id: number | null }>(
    `SELECT e.id, e.name, e.class_id, c.name AS class_name, c.teacher_id FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1`,
    [examId]
  );
  if (!exam) back(`${base}/marks`, 'Exam not found', true);
  await allowClass(exam.class_id);
  const path = `${base}/marks/${examId}`;

  const subjects = await q<{ subject: string; max_marks: number }>(`SELECT subject, max_marks FROM att.exam_subjects WHERE exam_id = $1 ORDER BY position`, [examId]);
  const students = await q<{ id: number; name: string }>(`SELECT id, name FROM att.students WHERE class_id = $1 AND active ORDER BY roll_no, name`, [exam.class_id]);
  const markRows = await q<{ student_id: number; subject: string; marks: string }>(`SELECT student_id, subject, marks FROM att.marks WHERE exam_id = $1`, [examId]);
  const marks = new Map(markRows.map((m) => [`${m.student_id}_${m.subject}`, Number(m.marks)]));
  const maxTotal = subjects.reduce((x, s) => x + s.max_marks, 0);

  const done = students
    .map((st) => {
      const got = subjects.map((s) => marks.get(`${st.id}_${s.subject}`));
      return { st, got, complete: got.every((g) => g !== undefined), total: got.reduce<number>((x, g) => x + (g ?? 0), 0) };
    })
    .filter((r) => r.complete);
  if (!done.length) back(path, 'Enter and save the marks first (a student needs all subjects filled)', true);

  const sorted = [...done].sort((a, b) => b.total - a.total);
  const rank = new Map<number, number>();
  sorted.forEach((r, i) => rank.set(r.st.id, i > 0 && r.total === sorted[i - 1].total ? rank.get(sorted[i - 1].st.id)! : i + 1));

  const guardians = await q<{ student_id: number; phone: string }>(
    `SELECT DISTINCT g.student_id, g.phone FROM att.guardians g JOIN att.students s ON s.id = g.student_id
     WHERE s.class_id = $1 AND s.active AND g.opt_in`,
    [exam.class_id]
  );
  const items: Notice[] = [];
  for (const r of done) {
    const pct = maxTotal ? (r.total / maxTotal) * 100 : 0;
    const text =
      `📝 *${exam.name} – Mark Sheet*\n\n*${r.st.name}* (Class ${exam.class_name})\n\n` +
      subjects.map((s, i) => `${s.subject}: ${r.got[i]}/${s.max_marks}`).join('\n') +
      `\n\n*Total:* ${r.total}/${maxTotal}\n*Percentage:* ${pct.toFixed(1)}%\n*Grade:* ${grade(pct)}\n*Rank:* ${rank.get(r.st.id)} of ${done.length}\n\n– Class Teacher, ${exam.class_name}`;
    for (const g of guardians.filter((x) => x.student_id === r.st.id)) items.push({ studentId: r.st.id, phone: g.phone, text });
  }
  await queueAndSend('marksheet', exam.class_id, examId, items, path, exam.teacher_id);
}
