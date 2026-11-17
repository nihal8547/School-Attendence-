'use server';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { allowClass, backTo } from '@/lib/access';
import { getLiveWaStatus } from '@/lib/wa';
import { queueNotices } from '@/lib/notify';
import { appBaseUrl } from '@/lib/settings';
import { signToken } from '@/lib/sign';
import { loadCards, fileNameFor } from '@/lib/reportcard';
import { classHasModule } from '@/lib/modules';

export async function sendReportCards(formData: FormData) {
  await ensureSchema();
  const base = formData.get('base') === '/admin' ? '/admin' : '/teacher';
  const examId = Number(formData.get('exam_id'));
  const path = `${base}/marks/${examId}`;
  const [exam] = await q<{ class_id: number; name: string; teacher_id: number | null }>(
    `SELECT e.class_id, e.name, c.teacher_id FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1`,
    [examId]
  );
  if (!exam) backTo(`${base}/marks`, 'Exam not found', true);
  await allowClass(exam.class_id);
  if (!(await classHasModule(exam.class_id, 'reportcards'))) backTo(path, 'Report cards are not enabled for this class.', true);

  const site = appBaseUrl();
  if (!site) backTo(path, 'PUBLIC_APP_URL is not set on the server, so the PDF link cannot be created. Add it to .env and restart the app.', true);
  if (!exam.teacher_id) backTo(path, 'This class has no class teacher assigned', true);
  if ((await getLiveWaStatus(exam.teacher_id)) !== 'connected') backTo(path, "The class teacher's WhatsApp is not connected. Connect it under My WhatsApp first.", true);

  const cards = (await loadCards(examId)).filter((c) => c.complete);
  if (!cards.length) backTo(path, 'Enter and save marks first (a student needs all subjects filled)', true);

  const exp = Date.now() + 3 * 24 * 3600 * 1000; // link valid for 3 days
  const items: { classId: number; studentId: number; phone: string; text: string; mediaUrl: string; mediaName: string }[] = [];
  for (const c of cards) {
    const gs = await q<{ phone: string }>(`SELECT DISTINCT phone FROM att.guardians WHERE student_id = $1 AND opt_in`, [c.student.id]);
    const sig = signToken(`rc:${examId}:${c.student.id}:${exp}`);
    const url = `${site}/api/report-card?exam=${examId}&student=${c.student.id}&exp=${exp}&sig=${sig}`;
    const text = `📄 *${exam.name} – Report Card*\n\n${c.student.name} (Class ${c.exam.className})\nPercentage: ${c.pct.toFixed(1)}% · Grade: ${c.grade}${c.rank ? ` · Rank ${c.rank}/${c.classSize}` : ''}\n\nPlease find the report card attached.\n– ${c.school.name}`;
    for (const g of gs) items.push({ classId: exam.class_id, studentId: c.student.id, phone: g.phone, text, mediaUrl: url, mediaName: fileNameFor(c) });
  }
  if (!items.length) backTo(path, 'No parents with a WhatsApp number to send to', true);
  const r = await queueNotices('reportcard', items, examId);
  if (!r.ok) backTo(path, 'Saved, but the WhatsApp sender (n8n) could not be started. Please try again.', true);
  backTo(path, `Sending ${r.count} report card PDF(s) on WhatsApp, one by one. This can take a few minutes.`);
}
