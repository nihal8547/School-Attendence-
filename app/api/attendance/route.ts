import { NextResponse } from 'next/server';
import { q, tx } from '@/lib/db';
import { getSession } from '@/lib/session';
import { callN8n, todayIST } from '@/lib/n8n';
import { holidayOn } from '@/lib/holidays';
import { ensureSchema } from '@/lib/academic';

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'teacher') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const classId = Number(body.class_id);
  const date = String(body.date || '');
  const session = String(body.session || '');
  const marks: { student_id: number; status: string }[] = Array.isArray(body.marks) ? body.marks : [];

  if (!['morning', 'afternoon'].includes(session)) return NextResponse.json({ ok: false, error: 'Bad session' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ ok: false, error: 'Bad date' }, { status: 400 });
  const today = todayIST();
  const minDate = new Date(Date.parse(today) - 2 * 86400000).toISOString().slice(0, 10);
  if (date > today || date < minDate) return NextResponse.json({ ok: false, error: 'Date must be within the last 2 days' }, { status: 400 });

  await ensureSchema();
  const holiday = await holidayOn(date);
  if (holiday) return NextResponse.json({ ok: false, error: `${date} is a holiday (${holiday}). Attendance cannot be marked.` }, { status: 400 });

  const own = await q(`SELECT id FROM att.classes WHERE id = $1 AND teacher_id = $2`, [classId, s.uid]);
  if (!own.length) return NextResponse.json({ ok: false, error: 'Not your class' }, { status: 403 });

  const roster = await q<{ id: number }>(`SELECT id FROM att.students WHERE class_id = $1 AND active`, [classId]);
  const allowed = new Set(roster.map((r) => r.id));
  const wanted = new Map<number, string>();
  for (const m of marks) if (allowed.has(Number(m.student_id)) && (m.status === 'P' || m.status === 'A')) wanted.set(Number(m.student_id), m.status);
  if (wanted.size !== roster.length) return NextResponse.json({ ok: false, error: 'Mark every student before submitting' }, { status: 400 });

  const ids = [...wanted.keys()];
  const statuses = ids.map((id) => wanted.get(id)!);

  // Everything is saved in ONE transaction, including the WhatsApp queue (att.message_log).
  // So even if n8n is busy or down, nothing is lost: the queue sweeper will pick the messages up.
  const queued = await tx(async (run) => {
    // A changed status must be re-sent as a correction: drop the old message rows first.
    await run(
      `DELETE FROM att.message_log ml USING att.attendance a
       JOIN unnest($1::int[], $2::text[]) AS x(id, st) ON x.id = a.student_id
       WHERE ml.attendance_id = a.id AND a.att_date = $3::date AND a.session = $4 AND a.status <> x.st`,
      [ids, statuses, date, session]
    );
    await run(
      `INSERT INTO att.attendance (student_id, att_date, session, status, marked_by)
       SELECT x.id, $3::date, $4, x.st, $5 FROM unnest($1::int[], $2::text[]) AS x(id, st)
       ON CONFLICT (student_id, att_date, session)
       DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
      [ids, statuses, date, session, s.uid]
    );
    await run(
      `INSERT INTO att.session_marks (class_id, att_date, session, marked_by) VALUES ($1,$2::date,$3,$4)
       ON CONFLICT (class_id, att_date, session) DO UPDATE SET marked_by = EXCLUDED.marked_by, marked_at = now()`,
      [classId, date, session, s.uid]
    );
    const r = await run(
      `INSERT INTO att.message_log (attendance_id, guardian_id)
       SELECT a.id, g.id FROM att.attendance a
       JOIN att.guardians g ON g.student_id = a.student_id AND g.opt_in
       WHERE a.student_id = ANY($1::int[]) AND a.att_date = $2::date AND a.session = $3
       ON CONFLICT (attendance_id, guardian_id) DO NOTHING`,
      [ids, date, session]
    );
    return r.rowCount;
  });

  const n8n = await callN8n('attendance-submitted', { class_id: classId, att_date: date, session });
  return NextResponse.json({ ok: true, saved: ids.length, queued, eta_minutes: Math.max(1, Math.ceil((queued * 9) / 60)), notify_started: n8n.ok });
}
