import { FormLike } from '../compat.js';
import bcrypt from 'bcryptjs';
import { revalidatePath } from '../compat.js';
import { redirect } from '../compat.js';
import { q } from '../lib/db.js';
import { requireRole } from '../lib/session.js';
import { allowClass, schoolOwns } from '../lib/access.js';
import { normalizeIndianPhone } from '../lib/phone.js';
import { callN8n } from '../lib/n8n.js';
import { importStudentRows, parseCsv, summarize } from '../lib/importer.js';

function back(path: string, msg: string, err = false): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);
}

export async function createTeacher(formData: FormLike) {
  const adm = await requireRole('admin');
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = normalizeIndianPhone(String(formData.get('phone') || ''));
  if (!name || !email || password.length < 8) back('/admin?tab=teachers', 'Name, email and an 8+ character password are required', true);
  if (!phone) back('/admin?tab=teachers', 'Enter a valid Indian mobile number for the teacher', true);
  const hash = await bcrypt.hash(password, 10);
  try {
    await q(`INSERT INTO att.users (name, email, phone, password_hash, role, school_id) VALUES ($1,$2,$3,$4,'teacher',$5)`, [name, email, phone, hash, adm.sid]);
  } catch {
    back('/admin?tab=teachers', 'That email is already used', true);
  }
  revalidatePath('/admin');
  back('/admin?tab=teachers', `Teacher ${name} added`);
}

export async function createClass(formData: FormLike) {
  const adm = await requireRole('admin');
  const name = String(formData.get('name') || '').trim();
  const teacherId = Number(formData.get('teacher_id')) || null;
  if (!name) back('/admin?tab=classes', 'Class name is required', true);
  if (teacherId && !(await schoolOwns(adm, 'user', teacherId))) back('/admin?tab=classes', 'Teacher not found', true);
  try {
    await q(`INSERT INTO att.classes (name, teacher_id, school_id) VALUES ($1,$2,$3)`, [name, teacherId, adm.sid]);
  } catch {
    back('/admin?tab=classes', 'A class with that name already exists', true);
  }
  revalidatePath('/admin');
  back('/admin?tab=classes', `Class ${name} added`);
}

export async function assignTeacher(formData: FormLike) {
  const adm = await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  const teacherId = Number(formData.get('teacher_id')) || null;
  if (!(await schoolOwns(adm, 'class', classId)) || (teacherId && !(await schoolOwns(adm, 'user', teacherId)))) back('/admin?tab=classes', 'Not found', true);
  await q(`UPDATE att.classes SET teacher_id = $2 WHERE id = $1`, [classId, teacherId]);
  revalidatePath('/admin');
  back('/admin?tab=classes', 'Class teacher updated');
}

export async function addStudent(formData: FormLike) {
  await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  await allowClass(classId);
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

// Pasted CSV lines: roll_no,student_name,guardian_name,phone
export async function importStudents(formData: FormLike) {
  await requireRole('admin');
  const classId = Number(formData.get('class_id'));
  await allowClass(classId);
  const base = `/admin/students?class=${classId}`;
  if (!classId) back(base, 'Pick a class first', true);
  let res;
  try {
    res = await importStudentRows(classId, parseCsv(String(formData.get('csv') || '')));
  } catch (e) {
    back(base, (e as Error).message, true);
  }
  revalidatePath('/admin/students');
  const sm = summarize(res!);
  back(base, sm.msg, sm.err);
}

export async function updateTeacher(formData: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(formData.get('user_id'));
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const phone = normalizeIndianPhone(String(formData.get('phone') || ''));
  const base = '/admin?tab=teachers';
  if (!(await schoolOwns(adm, 'user', id))) back(base, 'Teacher not found', true);
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back(base, 'Enter a name and a valid email', true);
  if (!phone) back(base, 'Enter a valid Indian mobile number', true);
  try {
    await q(`UPDATE att.users SET name = $2, email = $3, phone = $4 WHERE id = $1 AND role = 'teacher' AND school_id = $5`, [id, name, email, phone, adm.sid]);
  } catch {
    back(base, 'That email is already used', true);
  }
  revalidatePath('/admin');
  back(base, `${name} updated`);
}

export async function removeStudent(formData: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(formData.get('student_id'));
  const classId = Number(formData.get('class_id'));
  if (!(await schoolOwns(adm, 'student', id))) back('/admin/students', 'Student not found', true);
  await q(`UPDATE att.students SET active = FALSE WHERE id = $1`, [id]);
  revalidatePath('/admin/students');
  back(`/admin/students?class=${classId}`, 'Student removed from active list');
}

export async function retryFailed() {
  const adm = await requireRole('admin');
  await q(
    `UPDATE att.message_log ml SET attempts = 0 FROM att.attendance a JOIN att.students s ON s.id = a.student_id JOIN att.classes c ON c.id = s.class_id
     WHERE ml.attendance_id = a.id AND ml.status = 'failed' AND c.school_id = $1`,
    [adm.sid]
  );
  const sessions = await q(
    `SELECT DISTINCT s.class_id, a.att_date::text AS att_date, a.session
     FROM att.message_log ml
     JOIN att.attendance a ON a.id = ml.attendance_id
     JOIN att.students s ON s.id = a.student_id JOIN att.classes c ON c.id = s.class_id
     WHERE ml.status = 'failed' AND c.school_id = $1`,
    [adm.sid]
  );
  for (const r of sessions) await callN8n('attendance-submitted', { class_id: r.class_id, att_date: r.att_date, session: r.session });
  revalidatePath('/admin/logs');
  back('/admin/logs', `Retry started for ${sessions.length} session(s)`);
}
