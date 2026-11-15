import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { retryFailed } from '../actions';

export const dynamic = 'force-dynamic';

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const [stats] = await q(
    `SELECT COUNT(*) FILTER (WHERE status='sent') AS sent,
            COUNT(*) FILTER (WHERE status='failed') AS failed,
            COUNT(*) FILTER (WHERE status='queued') AS queued
     FROM att.message_log WHERE created_at > now() - interval '7 days'`
  );
  const rows = await q(
    `SELECT ml.id, ml.status, ml.error, ml.attempts, ml.sent_at, a.session, to_char(a.att_date,'DD Mon') AS d,
            a.status AS att_status, s.name AS student, c.name AS class_name, g.phone
     FROM att.message_log ml
     JOIN att.attendance a ON a.id = ml.attendance_id
     JOIN att.students s ON s.id = a.student_id
     JOIN att.classes c ON c.id = s.class_id
     JOIN att.guardians g ON g.id = ml.guardian_id
     ORDER BY ml.id DESC LIMIT 150`
  );
  return (
    <>
      <h1>Message log</h1>
      {sp.ok && <div className="msg">{sp.ok}</div>}
      <div className="card row" style={{ alignItems: 'center' }}>
        <span>Last 7 days: <strong>{stats.sent}</strong> sent · <strong>{stats.failed}</strong> failed · <strong>{stats.queued}</strong> queued</span>
        <span style={{ flex: 1 }} />
        <form action={retryFailed}><button type="submit" disabled={Number(stats.failed) === 0}>Retry failed</button></form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Date</th><th>Class</th><th>Student</th><th>Att.</th><th>Parent</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.d} · {r.session}</td><td>{r.class_name}</td><td>{r.student}</td>
                <td>{r.att_status === 'P' ? '✅' : '❌'}</td><td>{r.phone}</td>
                <td>
                  <span className={`badge ${r.status === 'sent' ? 'ok' : r.status === 'failed' ? 'bad' : 'wait'}`}>{r.status}</span>
                  {r.error && <div className="muted">{r.error}</div>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Nothing sent yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
