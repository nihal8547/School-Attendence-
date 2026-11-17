// Background jobs that used to be n8n schedules. n8n now only SENDS WhatsApp messages;
// deciding what to send and when lives here. Every job is safe to run twice (idempotent SQL) and
// guarded by a Postgres advisory lock so only one API instance runs a job at a time.
import { q } from './lib/db.js';
import { getPool } from './db.js';
import { callN8n } from './lib/n8n.js';

export const ABSENCE_SQL = `
WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date AS d),
daily AS (
  SELECT a.student_id, a.att_date, bool_and(a.status = 'A') AS all_absent
  FROM att.attendance a, today WHERE a.att_date >= today.d - 10 GROUP BY a.student_id, a.att_date
),
ranked AS (SELECT student_id, att_date, all_absent, row_number() OVER (PARTITION BY student_id ORDER BY att_date DESC) AS rn FROM daily),
streak AS (SELECT student_id, MAX(att_date) AS last_date FROM ranked WHERE rn <= 3 GROUP BY student_id HAVING COUNT(*) = 3 AND bool_and(all_absent)),
fresh AS (
  INSERT INTO att.absence_alerts (student_id, last_date, days)
  SELECT st.student_id, st.last_date, 3 FROM streak st JOIN att.students s ON s.id = st.student_id AND s.active, today
  WHERE st.last_date >= today.d - 1
    AND NOT EXISTS (SELECT 1 FROM att.absence_alerts x WHERE x.student_id = st.student_id AND x.last_date >= st.last_date - 7)
  ON CONFLICT DO NOTHING RETURNING student_id, last_date
),
b AS (SELECT gen_random_uuid()::text AS batch),
parents AS (
  INSERT INTO att.notice_log (batch, kind, class_id, student_id, phone, text)
  SELECT b.batch, 'absence', s.class_id, s.id, g.phone,
         concat_ws(E'\\n', '⚠️ *Attendance Alert*', '', 'Dear Parent,', '',
           '*' || s.name || '* has been absent for 3 consecutive school days (last absent: ' || to_char(f.last_date, 'DD Mon YYYY') || ').',
           'Please contact the class teacher and let us know the reason.', '', '– ' || sc.name)
  FROM fresh f JOIN att.students s ON s.id = f.student_id
  JOIN att.classes cl ON cl.id = s.class_id JOIN att.schools sc ON sc.id = cl.school_id
  JOIN att.guardians g ON g.student_id = s.id AND g.opt_in CROSS JOIN b RETURNING 1
),
teachers AS (
  INSERT INTO att.notice_log (batch, kind, class_id, student_id, phone, text)
  SELECT b.batch, 'absence', c.id, NULL, u.phone,
         '⚠️ *Absence alert – Class ' || c.name || '*' || E'\\n\\n' || 'Absent 3 school days in a row:' || E'\\n' || string_agg('• ' || s.name, E'\\n' ORDER BY s.roll_no)
  FROM fresh f JOIN att.students s ON s.id = f.student_id
  JOIN att.classes c ON c.id = s.class_id JOIN att.users u ON u.id = c.teacher_id AND u.phone IS NOT NULL
  CROSS JOIN b GROUP BY b.batch, c.id, c.name, u.phone RETURNING 1
)
SELECT b.batch, (SELECT COUNT(*) FROM fresh) AS students FROM b WHERE EXISTS (SELECT 1 FROM fresh)`;

async function withLock(id: number, fn: () => Promise<void>) {
  const c = await getPool().connect();
  try {
    const { rows } = await c.query('SELECT pg_try_advisory_lock($1) AS ok', [id]);
    if (!rows[0].ok) return;
    try {
      await fn();
    } finally {
      await c.query('SELECT pg_advisory_unlock($1)', [id]);
    }
  } finally {
    c.release();
  }
}

/** Recover attendance messages that were claimed but never finished, and restart sending for stuck sessions. */
export async function sweepQueue() {
  await withLock(727101, async () => {
    const sessions = await q<{ class_id: number; att_date: string; session: string }>(
      `WITH reset AS (UPDATE att.message_log SET status = 'queued' WHERE status = 'sending' AND locked_at < now() - interval '20 minutes' RETURNING 1)
       SELECT DISTINCT s.class_id, to_char(a.att_date, 'YYYY-MM-DD') AS att_date, a.session
       FROM att.message_log ml
       JOIN att.attendance a ON a.id = ml.attendance_id
       JOIN att.students s ON s.id = a.student_id
       WHERE ((ml.status = 'queued' AND ml.created_at < now() - interval '3 minutes')
           OR (ml.status = 'failed' AND ml.attempts < 3 AND ml.locked_at < now() - interval '10 minutes'))
         AND a.att_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 3
         AND NOT EXISTS (
           SELECT 1 FROM att.message_log m2 JOIN att.attendance a2 ON a2.id = m2.attendance_id JOIN att.students s2 ON s2.id = a2.student_id
           WHERE m2.status = 'sending' AND s2.class_id = s.class_id AND a2.att_date = a.att_date AND a2.session = a.session)
       LIMIT 40`
    );
    for (const s of sessions) await callN8n('attendance-submitted', s);
  });
}

/** Once a day after 17:30 IST: parents of students absent 3 school days in a row. */
export async function absenceAlert() {
  await withLock(727102, async () => {
    const [t] = await q<{ d: string; h: number; m: number }>(
      `SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d, EXTRACT(hour FROM now() AT TIME ZONE 'Asia/Kolkata')::int AS h, EXTRACT(minute FROM now() AT TIME ZONE 'Asia/Kolkata')::int AS m`
    );
    if (t.h < 17 || (t.h === 17 && t.m < 30)) return;
    const claimed = await q(`INSERT INTO att.job_runs (name, run_date) VALUES ('absence-alert', $1::date) ON CONFLICT DO NOTHING RETURNING 1`, [t.d]);
    if (!claimed.length) return;
    const [r] = await q<{ batch: string; students: string }>(ABSENCE_SQL);
    if (r?.batch) {
      await callN8n('send-notices', { batch: r.batch });
      await q(`UPDATE att.job_runs SET result = $2 WHERE name = 'absence-alert' AND run_date = $1::date`, [t.d, `${r.students} students`]);
    }
  });
}

export function startScheduler(log: (m: string) => void) {
  const safe = (name: string, fn: () => Promise<void>) => () => fn().catch((e) => log(`job ${name} failed: ${e?.message || e}`));
  const timers = [
    setInterval(safe('sweep', sweepQueue), 2 * 60_000),
    setInterval(safe('absence', absenceAlert), 60_000),
    setInterval(safe('cleanup', async () => {
      await q(`DELETE FROM att.notice_log WHERE kind = 'otp' AND created_at < now() - interval '1 hour'`);
      await q(`DELETE FROM att.audit_log WHERE created_at < now() - interval '180 days'`);
    }), 60 * 60_000),
  ];
  timers.forEach((t) => t.unref());
  log('scheduler started (queue sweeper 2 min, absence alert daily 17:30 IST)');
}
