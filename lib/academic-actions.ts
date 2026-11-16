'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { getSession } from '@/lib/session';
import { ensureAcademicTables, DAYS, PERIODS } from '@/lib/academic';

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
