import { getSession } from '@/lib/session';
import { verifyToken } from '@/lib/sign';
import { ensureSchema } from '@/lib/academic';
import { q } from '@/lib/db';
import { loadCards, buildPdf, fileNameFor } from '@/lib/reportcard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/report-card?exam=1&student=2[&exp=..&sig=..]
 * Either a valid signed link (used by WhatsApp/Evolution to fetch the PDF) or a logged-in admin / the class teacher.
 */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const exam = Number(u.get('exam'));
  const student = Number(u.get('student'));
  const exp = Number(u.get('exp') || 0);
  const sig = u.get('sig') || '';
  if (!exam || !student) return new Response('bad request', { status: 400 });
  await ensureSchema();

  let ok = false;
  if (sig) {
    ok = exp > Date.now() && verifyToken(`rc:${exam}:${student}:${exp}`, sig);
  } else {
    const s = await getSession();
    if (s) {
      if (s.role === 'admin') {
        ok = (await q(`SELECT 1 FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.school_id = $2`, [exam, s.sid])).length > 0;
      } else if (s.role === 'teacher') {
        const own = await q(`SELECT 1 FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.teacher_id = $2`, [exam, s.uid]);
        ok = own.length > 0;
      }
    }
  }
  if (!ok) return new Response('forbidden', { status: 403 });

  const [card] = await loadCards(exam, student);
  if (!card) return new Response('not found', { status: 404 });
  const bytes = await buildPdf([card]);
  return new Response(Buffer.from(bytes), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${fileNameFor(card)}"`,
      'cache-control': 'private, no-store',
    },
  });
}
