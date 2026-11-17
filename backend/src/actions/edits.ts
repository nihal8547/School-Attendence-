// Edit / disable / delete actions for records that could previously only be created.
import { FormLike, revalidatePath } from '../compat.js';
import { q } from '../lib/db.js';
import { requireRole } from '../lib/session.js';
import { allowClass, schoolOwns, backTo, baseFor } from '../lib/access.js';
import { normalizeIndianPhone } from '../lib/phone.js';
import { getSession } from '../lib/session.js';
import { clearCache } from '../cache.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const T = '/admin?tab=teachers';
const C = '/admin?tab=classes';

export async function setTeacherActive(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('user_id'));
  const on = f.get('active') === '1';
  if (!(await schoolOwns(adm, 'user', id))) backTo(T, 'Teacher not found', true);
  await q(`UPDATE att.users SET active = $2 WHERE id = $1 AND role = 'teacher' AND school_id = $3`, [id, on, adm.sid]);
  clearCache();
  revalidatePath('/admin');
  backTo(T, on ? 'Teacher enabled' : 'Teacher disabled (cannot sign in)');
}

export async function deleteTeacher(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('user_id'));
  if (!(await schoolOwns(adm, 'user', id))) backTo(T, 'Teacher not found', true);
  try {
    await q(`DELETE FROM att.users WHERE id = $1 AND role = 'teacher' AND school_id = $2`, [id, adm.sid]);
  } catch {
    backTo(T, 'This teacher has attendance records, so it cannot be deleted. Disable the account instead.', true);
  }
  clearCache();
  revalidatePath('/admin');
  backTo(T, 'Teacher deleted');
}

export async function updateClass(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('class_id'));
  const name = String(f.get('name') || '').trim().slice(0, 60);
  if (!(await schoolOwns(adm, 'class', id))) backTo(C, 'Class not found', true);
  if (!name) backTo(C, 'Class name is required', true);
  try {
    await q(`UPDATE att.classes SET name = $2 WHERE id = $1`, [id, name]);
  } catch {
    backTo(C, 'A class with that name already exists', true);
  }
  clearCache();
  revalidatePath('/admin');
  backTo(C, 'Class renamed');
}

export async function deleteClass(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('class_id'));
  if (!(await schoolOwns(adm, 'class', id))) backTo(C, 'Class not found', true);
  const [n] = await q<{ n: string }>(`SELECT COUNT(*) AS n FROM att.students WHERE class_id = $1`, [id]);
  if (Number(n.n) > 0) backTo(C, 'This class still has students. Move or remove them first.', true);
  await q(`DELETE FROM att.classes WHERE id = $1`, [id]);
  clearCache();
  revalidatePath('/admin');
  backTo(C, 'Class deleted');
}

export async function updateStudent(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('student_id'));
  const classId = Number(f.get('class_id'));
  const base = `/admin/students?class=${classId}`;
  const name = String(f.get('name') || '').trim().slice(0, 120);
  const roll = Math.max(0, Number(f.get('roll_no')) || 0);
  const gName = String(f.get('guardian_name') || '').trim().slice(0, 120) || null;
  const phone = normalizeIndianPhone(String(f.get('phone') || ''));
  const newClass = Number(f.get('new_class_id')) || classId;
  if (!(await schoolOwns(adm, 'student', id)) || !(await schoolOwns(adm, 'class', newClass))) backTo('/admin/students', 'Student not found', true);
  if (!name) backTo(base, 'Student name is required', true);
  if (!phone) backTo(base, 'Parent WhatsApp number must be a valid Indian mobile number', true);
  await q(`UPDATE att.students SET name = $2, roll_no = $3, class_id = $4 WHERE id = $1`, [id, name, roll, newClass]);
  const upd = await q(`UPDATE att.guardians SET name = $2, phone = $3 WHERE id = (SELECT id FROM att.guardians WHERE student_id = $1 ORDER BY is_primary DESC, id LIMIT 1) RETURNING id`, [id, gName, phone]);
  if (!upd.length) await q(`INSERT INTO att.guardians (student_id, name, phone) VALUES ($1,$2,$3)`, [id, gName, phone]);
  clearCache();
  revalidatePath('/admin/students');
  backTo(`/admin/students?class=${newClass}`, `${name} updated`);
}

export async function updateFeeItem(f: FormLike) {
  const adm = await requireRole('admin');
  const id = Number(f.get('id'));
  const name = String(f.get('name') || '').trim().slice(0, 80);
  const due = String(f.get('due_date') || '');
  const amount = Number(f.get('amount'));
  const path = `/admin/fees/${id}`;
  if (!(await schoolOwns(adm, 'fee_item', id))) backTo('/admin/fees', 'Fee not found', true);
  if (!name) backTo(path, 'Fee name is required', true);
  if (due && !ISO.test(due)) backTo(path, 'Invalid due date', true);
  const [p] = await q<{ n: string; a: string }>(
    `SELECT (SELECT COUNT(*) FROM att.fee_payments p JOIN att.fee_dues d ON d.id = p.due_id WHERE d.fee_item_id = $1) AS n, (SELECT amount FROM att.fee_items WHERE id = $1) AS a`,
    [id]
  );
  const changeAmount = Number(p.a) !== amount;
  if (changeAmount) {
    if (!(amount > 0) || amount > 10000000) backTo(path, 'Enter a valid amount', true);
    if (Number(p.n) > 0) backTo(path, 'Amount cannot be changed after payments are recorded', true);
  }
  await q(`UPDATE att.fee_items SET name = $2, due_date = NULLIF($3,'')::date, amount = $4 WHERE id = $1`, [id, name, due, changeAmount ? amount : Number(p.a)]);
  if (changeAmount) await q(`UPDATE att.fee_dues SET amount = $2, concession = LEAST(concession, $2) WHERE fee_item_id = $1`, [id, amount]);
  revalidatePath(path);
  backTo(path, 'Fee updated');
}

export async function deletePayment(f: FormLike) {
  const adm = await requireRole('admin');
  const pid = Number(f.get('payment_id'));
  const [row] = await q<{ item: number }>(
    `SELECT d.fee_item_id AS item FROM att.fee_payments p JOIN att.fee_dues d ON d.id = p.due_id JOIN att.fee_items fi ON fi.id = d.fee_item_id JOIN att.classes c ON c.id = fi.class_id WHERE p.id = $1 AND c.school_id = $2`,
    [pid, adm.sid]
  );
  if (!row) backTo('/admin/fees', 'Payment not found', true);
  await q(`DELETE FROM att.fee_payments WHERE id = $1`, [pid]);
  revalidatePath(`/admin/fees/${row.item}`);
  backTo(`/admin/fees/${row.item}`, 'Payment removed');
}

export async function updateExam(f: FormLike) {
  const s = await getSession();
  if (!s || s.role === 'superadmin') backTo('/login', 'Please sign in', true);
  const base = baseFor(s!.role);
  const examId = Number(f.get('exam_id'));
  const [exam] = await q<{ class_id: number }>(`SELECT class_id FROM att.exams WHERE id = $1`, [examId]);
  if (!exam) backTo(`${base}/marks`, 'Exam not found', true);
  await allowClass(exam.class_id);
  const path = `${base}/marks/${examId}`;
  const name = String(f.get('name') || '').trim().slice(0, 80);
  const date = String(f.get('exam_date') || '');
  if (!name) backTo(path, 'Exam name is required', true);
  await q(`UPDATE att.exams SET name = $2, exam_date = $3 WHERE id = $1`, [examId, name, ISO.test(date) ? date : null]);
  revalidatePath(path);
  backTo(path, 'Exam updated');
}

export async function updateHomework(f: FormLike) {
  const s = await getSession();
  if (!s || s.role === 'superadmin') backTo('/login', 'Please sign in', true);
  const base = baseFor(s!.role);
  const id = Number(f.get('id'));
  const [h] = await q<{ class_id: number }>(`SELECT class_id FROM att.homework WHERE id = $1`, [id]);
  if (!h) backTo(`${base}/homework`, 'Not found', true);
  await allowClass(h.class_id);
  const path = `${base}/homework?class=${h.class_id}`;
  const subject = String(f.get('subject') || '').trim().slice(0, 60);
  const title = String(f.get('title') || '').trim().slice(0, 120);
  const details = String(f.get('details') || '').trim().slice(0, 1000);
  const due = String(f.get('due_date') || '');
  if (!subject || !title) backTo(path, 'Subject and title are required', true);
  if (due && !ISO.test(due)) backTo(path, 'Invalid due date', true);
  await q(`UPDATE att.homework SET subject = $2, title = $3, details = $4, due_date = NULLIF($5,'')::date WHERE id = $1`, [id, subject, title, details, due]);
  revalidatePath(path);
  backTo(path, 'Homework updated');
}
