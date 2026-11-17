'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { mustAdmin, backTo } from '@/lib/access';
import { queueNotices } from '@/lib/notify';
import { fmtDate, fmtMoney } from '@/lib/format';
import { getSchool } from '@/lib/settings';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function createFeeItem(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const amount = Number(formData.get('amount'));
  const due = String(formData.get('due_date') || '');
  const cls = String(formData.get('class_id') || '');
  if (!name) backTo('/admin/fees', 'Fee name is required', true);
  if (!(amount > 0) || amount > 10000000) backTo('/admin/fees', 'Enter a valid amount', true);
  if (due && !ISO.test(due)) backTo('/admin/fees', 'Invalid due date', true);
  const classIds = cls === 'all' ? (await q<{ id: number }>(`SELECT id FROM att.classes`)).map((c) => c.id) : [Number(cls)];
  if (!classIds.length || classIds.some((c) => !c)) backTo('/admin/fees', 'Choose a class', true);
  for (const cid of classIds) {
    const [item] = await q<{ id: number }>(
      `INSERT INTO att.fee_items (class_id, name, amount, due_date) VALUES ($1, $2, $3, NULLIF($4, '')::date) RETURNING id`,
      [cid, name, amount, due]
    );
    await q(
      `INSERT INTO att.fee_dues (fee_item_id, student_id, amount)
       SELECT $1, s.id, $2 FROM att.students s WHERE s.class_id = $3 AND s.active
       ON CONFLICT (fee_item_id, student_id) DO NOTHING`,
      [item.id, amount, cid]
    );
  }
  revalidatePath('/admin/fees');
  backTo('/admin/fees', `Fee "${name}" created for ${classIds.length} class${classIds.length > 1 ? 'es' : ''}`);
}

export async function deleteFeeItem(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const id = Number(formData.get('id'));
  const [p] = await q<{ n: string }>(
    `SELECT COUNT(*) AS n FROM att.fee_payments p JOIN att.fee_dues d ON d.id = p.due_id WHERE d.fee_item_id = $1`,
    [id]
  );
  if (Number(p.n) > 0) backTo('/admin/fees', 'This fee already has payments and cannot be deleted', true);
  await q(`DELETE FROM att.fee_items WHERE id = $1`, [id]);
  revalidatePath('/admin/fees');
  backTo('/admin/fees', 'Fee removed');
}

export async function setConcession(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const dueId = Number(formData.get('due_id'));
  const itemId = Number(formData.get('item_id'));
  const c = Math.max(0, Number(formData.get('concession')) || 0);
  const [d] = await q<{ amount: string; paid: string }>(
    `SELECT d.amount, COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0) AS paid FROM att.fee_dues d WHERE d.id = $1`,
    [dueId]
  );
  const path = `/admin/fees/${itemId}`;
  if (!d) backTo(path, 'Not found', true);
  if (c > Number(d.amount)) backTo(path, 'Concession cannot exceed the fee', true);
  if (Number(d.amount) - c < Number(d.paid)) backTo(path, 'Concession would make the amount less than what is already paid', true);
  await q(`UPDATE att.fee_dues SET concession = $2 WHERE id = $1`, [dueId, c]);
  revalidatePath(path);
  backTo(path, 'Concession saved');
}

export async function recordPayment(formData: FormData) {
  await ensureSchema();
  const s = await mustAdmin();
  const dueId = Number(formData.get('due_id'));
  const itemId = Number(formData.get('item_id'));
  const amount = Number(formData.get('amount'));
  const method = ['cash', 'upi', 'bank', 'cheque', 'other'].includes(String(formData.get('method'))) ? String(formData.get('method')) : 'cash';
  const paidOn = ISO.test(String(formData.get('paid_on'))) ? String(formData.get('paid_on')) : null;
  const note = String(formData.get('note') || '').trim().slice(0, 120);
  const path = `/admin/fees/${itemId}`;
  const [d] = await q<{ due: string }>(
    `SELECT d.amount - d.concession - COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0) AS due
     FROM att.fee_dues d WHERE d.id = $1 AND d.fee_item_id = $2`,
    [dueId, itemId]
  );
  if (!d) backTo(path, 'Student fee not found', true);
  if (!(amount > 0)) backTo(path, 'Enter a valid amount', true);
  if (amount > Number(d.due) + 0.001) backTo(path, `Amount is more than the balance (${fmtMoney(d.due)})`, true);
  const [p] = await q<{ id: number }>(
    `INSERT INTO att.fee_payments (due_id, amount, paid_on, method, note, created_by)
     VALUES ($1, $2, COALESCE($3::date, (now() AT TIME ZONE 'Asia/Kolkata')::date), $4, $5, $6) RETURNING id`,
    [dueId, amount, paidOn, method, note, s.uid]
  );
  revalidatePath(path);
  redirect302(`/admin/fees/receipt/${p.id}`);
}

import { redirect } from 'next/navigation';
function redirect302(p: string): never {
  redirect(p);
}

type DueRow = { class_id: number; student_id: number; student: string; item: string; due_date: string | null; balance: string };

async function pendingRows(itemId: number, dueId: number | null): Promise<DueRow[]> {
  return q<DueRow>(
    `SELECT fi.class_id, s.id AS student_id, s.name AS student, fi.name AS item, to_char(fi.due_date, 'YYYY-MM-DD') AS due_date,
            (d.amount - d.concession - COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0)) AS balance
     FROM att.fee_dues d
     JOIN att.fee_items fi ON fi.id = d.fee_item_id
     JOIN att.students s ON s.id = d.student_id AND s.active
     WHERE d.fee_item_id = $1 AND ($2::int IS NULL OR d.id = $2)`,
    [itemId, dueId]
  ).then((r) => r.filter((x) => Number(x.balance) > 0.001));
}

export async function sendFeeReminders(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const itemId = Number(formData.get('item_id'));
  const dueId = formData.get('due_id') ? Number(formData.get('due_id')) : null;
  const path = `/admin/fees/${itemId}`;
  const rows = await pendingRows(itemId, dueId);
  if (!rows.length) backTo(path, 'No pending fees to remind about', true);
  const school = await getSchool();
  const items: { classId: number; studentId: number; phone: string; text: string; refId: number }[] = [];
  for (const r of rows) {
    const gs = await q<{ phone: string }>(`SELECT DISTINCT phone FROM att.guardians WHERE student_id = $1 AND opt_in`, [r.student_id]);
    const text =
      `💰 *Fee Reminder*\n\nDear Parent,\n\nThe fee *${r.item}* for *${r.student}* is pending.\n` +
      `Balance: *${fmtMoney(r.balance)}*\n` +
      (r.due_date ? `Due date: ${fmtDate(r.due_date)}\n` : '') +
      `\nPlease pay at the school office. Kindly ignore this message if already paid.\n\n– ${school.name}`;
    for (const g of gs) items.push({ classId: r.class_id, studentId: r.student_id, phone: g.phone, text, refId: itemId });
  }
  if (!items.length) backTo(path, 'No parent WhatsApp numbers found for these students', true);
  const res = await queueNotices('fee', items);
  revalidatePath(path);
  backTo(path, res.ok ? `Reminder is being sent to ${res.count} parent number(s) on WhatsApp` : 'Saved, but the WhatsApp sender could not be started', !res.ok);
}

export async function sendReceipt(formData: FormData) {
  await ensureSchema();
  await mustAdmin();
  const pid = Number(formData.get('payment_id'));
  const path = `/admin/fees/receipt/${pid}`;
  const [r] = await q<{ class_id: number; student_id: number; student: string; item: string; amount: string; paid_on: string; method: string; balance: string }>(
    `SELECT fi.class_id, s.id AS student_id, s.name AS student, fi.name AS item, p.amount, to_char(p.paid_on, 'YYYY-MM-DD') AS paid_on, p.method,
            (d.amount - d.concession - COALESCE((SELECT SUM(amount) FROM att.fee_payments WHERE due_id = d.id), 0)) AS balance
     FROM att.fee_payments p JOIN att.fee_dues d ON d.id = p.due_id
     JOIN att.fee_items fi ON fi.id = d.fee_item_id JOIN att.students s ON s.id = d.student_id WHERE p.id = $1`,
    [pid]
  );
  if (!r) backTo('/admin/fees', 'Receipt not found', true);
  const gs = await q<{ phone: string }>(`SELECT DISTINCT phone FROM att.guardians WHERE student_id = $1 AND opt_in`, [r.student_id]);
  if (!gs.length) backTo(path, 'No parent WhatsApp number for this student', true);
  const school = await getSchool();
  const text =
    `🧾 *Fee Receipt #${String(pid).padStart(5, '0')}*\n\nStudent: *${r.student}*\nFee: ${r.item}\n` +
    `Paid: *${fmtMoney(r.amount)}* on ${fmtDate(r.paid_on)} (${r.method.toUpperCase()})\n` +
    (Number(r.balance) > 0.001 ? `Balance: ${fmtMoney(r.balance)}\n` : `Status: ✅ Fully paid\n`) +
    `\nThank you.\n– ${school.name}`;
  const res = await queueNotices('receipt', gs.map((g) => ({ classId: r.class_id, studentId: r.student_id, phone: g.phone, text, refId: pid })));
  backTo(path, res.ok ? 'Receipt is being sent on WhatsApp' : 'Could not start the WhatsApp sender', !res.ok);
}
