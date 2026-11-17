'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { allowClass, baseFor, backTo } from '@/lib/access';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { guardianTargets, queueNotices } from '@/lib/notify';
import { getSchool } from '@/lib/settings';
import { getLiveWaStatus } from '@/lib/wa';

export async function sendAnnouncement(formData: FormData) {
  await ensureSchema();
  const s = await getSession();
  if (!s) redirect('/login');
  const base = baseFor(s.role);
  const path = `${base}/announcements`;

  const title = String(formData.get('title') || '').trim().slice(0, 80);
  const body = String(formData.get('body') || '').trim().slice(0, 1000);
  const audience = String(formData.get('audience') || '');
  if (!title || !body) backTo(path, 'Title and message are required', true);

  let classId: number | null = null;
  let all = false;
  let signoff = '';
  if (audience === 'all') {
    if (s.role !== 'admin') backTo(path, 'Only the admin can message the whole school', true);
    all = true;
    signoff = `– ${(await getSchool(s.sid)).name}`;
  } else {
    classId = Number(audience);
    await allowClass(classId);
    const [c] = await q<{ name: string; teacher_id: number | null }>(`SELECT name, teacher_id FROM att.classes WHERE id = $1`, [classId]);
    if (!c) backTo(path, 'Class not found', true);
    if (!c.teacher_id) backTo(path, 'This class has no class teacher (WhatsApp sender)', true);
    if ((await getLiveWaStatus(c.teacher_id)) !== 'connected') {
      backTo(path, "The class teacher's WhatsApp is not connected. Connect it under My WhatsApp first.", true);
    }
    signoff = `– Class Teacher, ${c.name}`;
  }

  const text = `📢 *${title}*\n\n${body}\n\n${signoff}`;
  const seen = new Set<string>();
  const targets = (await guardianTargets(s.sid, classId)).filter((t) => (seen.has(t.phone) ? false : (seen.add(t.phone), true)));
  if (!targets.length) backTo(path, 'No parents with a WhatsApp number in this audience', true);

  const [a] = await q<{ id: number }>(
    `INSERT INTO att.announcements (title, body, class_id, all_school, created_by, recipients, school_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [title, body, classId, all, s.uid, targets.length, s.sid]
  );
  const r = await queueNotices(
    'announcement',
    targets.map((t) => ({ classId: t.class_id, studentId: t.student_id, phone: t.phone, text, refId: a.id }))
  );
  revalidatePath(path);
  if (!r.ok) backTo(path, 'Saved, but the WhatsApp sender (n8n) could not be started. Please try again.', true);
  backTo(path, `Sending to ${r.count} parent${r.count === 1 ? '' : 's'}. Messages go out one by one, so it can take a few minutes.`);
}
