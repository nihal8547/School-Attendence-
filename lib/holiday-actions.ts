'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { mustAdmin, backTo } from '@/lib/access';
import { guardianTargets, queueNotices } from '@/lib/notify';
import { fmtDate } from '@/lib/format';
import { getSchool } from '@/lib/settings';

const PATH = '/admin/holidays';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function addHoliday(formData: FormData) {
  await ensureSchema();
  const adm = await mustAdmin();
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const from = String(formData.get('from') || '');
  const to = String(formData.get('to') || '') || from;
  const notify = formData.get('notify') === 'on';
  if (!name) backTo(PATH, 'Holiday name is required', true);
  if (!ISO.test(from) || !ISO.test(to) || to < from) backTo(PATH, 'Choose a valid date (or date range)', true);
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > 60) backTo(PATH, 'A holiday range can be at most 60 days', true);

  await q(
    `INSERT INTO att.holidays (holiday_date, name, school_id)
     SELECT d::date, $3, $4 FROM generate_series($1::date, $2::date, interval '1 day') AS d
     ON CONFLICT (school_id, holiday_date) DO UPDATE SET name = EXCLUDED.name`,
    [from, to, name, adm.sid]
  );
  revalidatePath(PATH);

  let extra = '';
  if (notify) {
    const school = await getSchool(adm.sid);
    const when = from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`;
    const text = `🏖️ *Holiday Notice*\n\n${name}\nDate: ${when}\n\nThe school will remain closed.\n\n– ${school.name}`;
    const seen = new Set<string>();
    const items = (await guardianTargets(adm.sid, null))
      .filter((t) => (seen.has(t.phone) ? false : (seen.add(t.phone), true)))
      .map((t) => ({ classId: t.class_id, studentId: t.student_id, phone: t.phone, text }));
    const r = await queueNotices('holiday', items);
    extra = r.ok ? ` Notice is being sent to ${r.count} parents on WhatsApp.` : ' Saved, but the WhatsApp sender could not be started.';
  }
  backTo(PATH, `Holiday saved.${extra}`);
}

export async function deleteHoliday(formData: FormData) {
  await ensureSchema();
  const adm = await mustAdmin();
  await q(`DELETE FROM att.holidays WHERE id = $1 AND school_id = $2`, [Number(formData.get('id')), adm.sid]);
  revalidatePath(PATH);
  backTo(PATH, 'Holiday removed');
}
