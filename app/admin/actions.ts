'use server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { normalizeIndianPhone } from '@/lib/phone';
import { callN8n } from '@/lib/n8n';

function back(path: string, msg: string, err = false): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
}

export async function createTeacher(formData: FormData) {
  await requireRole('admin');
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = normalizeIndianPhone(String(formData.get('phone') || ''));
  if (!name || !email || password.length < 8) back('/admin', 'Name, email and an 8+ character password are required', true);
  if (!phone) back('/admin', 'Enter a valid Indian mobile number for the teacher', true);
  const hash = await bcrypt.hash(password, 10);
  try {
    await q(`INSERT INTO att.users (name, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,'teacher')`, [name, email, phone, hash]);
  } catch {
    back('/admin', 'That email is already used', true);
  }
  revalidatePath('/admin');
  back('/admin', `Teacher ${name} added`);
}

export async function createClass(formData: FormData) {
  await requireRole('admin');
  const name = String(formData.get('name') || '').trim();
  const teacherId = Number(formData.get('teacher_id')) || null;
  if (!name) back('/admin', 'Class name is required', true);
  try {
    await q(`INSERT INTO att.classes (name, teacher_id) VALUES ($1,$2)`, [name, teacherId]);
  } catch {
    back('/admin', 'A class with that name already exists', true);
  }
  revalidatePath('/admin');
  back('/admin', `Class ${name} added`);
}

export async function assignTeacher(formData: FormData) {
  await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  const teacherId = Number(formData.get('teacher_id')) || null;
  await q(`UPDATE att.classes SET teacher_id = $2 WHERE id = $1`, [classId, teacherId]);
  revalidatePath('/admin');
  back('/admin', 'Class teacher updated');
}

export async function addStudent(formData: FormData) {
  await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  const base = `/admin/students?class=${classId}`;
  const name = String(formData.get('name') || '').trim();
  const roll = Number(formData.get('roll_no')) || 0;
  const gName = String(formData.get('guardian_name') || '').trim() || null;
  const phone = normalizeIndianPhone(String(formData.get('phone') || ''));
  if (!classId || !name) back(base, 'Class and student name are required', true);
  if (!phone) back(base, 'Parent WhatsApp number must be a valid Indian mobile number', true);
  const [s] = await q(`INSERT INTO att.students (class_id, roll_no, name) VALUES ($1,$2,$3) RETURNING id`, [classId, roll, name]);
  await q(`INSERT INTO att.guardians (student_id, name, phone) VALUES ($1,$2,$3)`, [s.id, gName, phone]);
  revalidatePath('/admin/students');
  back(base, `${name} added`);
}

// CSV lines: roll_no,student_name,guardian_name,phone
export async function importStudents(formData: FormData) {
  await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  const base = `/admin/students?class=${classId}`;
  const text = String(formData.get('csv') || '');
  if (!classId) back(base, 'Pick a class first', true);
  let added = 0;
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^roll/i.test(line)) continue;
    const [roll, name, gName, phoneRaw] = line.split(',').map((x) => x.trim());
    const phone = normalizeIndianPhone(phoneRaw);
    if (!name || !phone) {
      bad.push(line);
      continue;
    }
    const [s] = await q(`INSERT INTO att.students (class_id, roll_no, name) VALUES ($1,$2,$3) RETURNING id`, [classId, Number(roll) || 0, name]);
    await q(`INSERT INTO att.guardians (student_id, name, phone) VALUES ($1,$2,$3)`, [s.id, gName || null, phone]);
    added++;
  }
  revalidatePath('/admin/students');
  if (bad.length) back(base, `${added} added. ${bad.length} skipped (bad name/phone): ${bad.slice(0, 3).join(' | ')}`, true);
  back(base, `${added} students imported`);
}

export async function removeStudent(formData: FormData) {
  await requireRole('admin');
  const id = Number(formData.get('student_id'));
  const classId = Number(formData.get('class_id'));
  await q(`UPDATE att.students SET active = FALSE WHERE id = $1`, [id]);
  revalidatePath('/admin/students');
  back(`/admin/students?class=${classId}`, 'Student removed from active list');
}

export async function retryFailed() {
  await requireRole('admin');
  await q(`UPDATE att.message_log SET attempts = 0 WHERE status = 'failed'`);
  const sessions = await q(
    `SELECT DISTINCT s.class_id, a.att_date::text AS att_date, a.session
     FROM att.message_log ml
     JOIN att.attendance a ON a.id = ml.attendance_id
     JOIN att.students s ON s.id = a.student_id
     WHERE ml.status = 'failed'`
  );
  for (const r of sessions) await callN8n('attendance-submitted', { class_id: r.class_id, att_date: r.att_date, session: r.session });
  revalidatePath('/admin/logs');
  back('/admin/logs', `Retry started for ${sessions.length} session(s)`);
}
