import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { retryFailed } from '../actions';

export const dynamic = 'force-dynamic';

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const s = await requireRole('admin');
  const sp = await searchParams;
  const [stats] = await q(
    `SELECT COUNT(*) FILTER (WHERE ml2.status='sent') AS sent,
            COUNT(*) FILTER (WHERE ml2.status='failed') AS failed,
            COUNT(*) FILTER (WHERE ml2.status IN ('queued','sending')) AS queued
     FROM att.message_log ml2 JOIN att.attendance a2 ON a2.id = ml2.attendance_id JOIN att.students s2 ON s2.id = a2.student_id JOIN att.classes c2 ON c2.id = s2.class_id
     WHERE ml2.created_at > now() - interval '7 days' AND c2.school_id = $1`,
    [s.sid]
  );
  const rows = await q(
    `SELECT ml.id, ml.status, ml.error, ml.attempts, ml.sent_at, a.session, to_char(a.att_date,'DD Mon') AS d,
            a.status AS att_status, s.name AS student, c.name AS class_name, g.phone
     FROM att.message_log ml
     JOIN att.attendance a ON a.id = ml.attendance_id
     JOIN att.students s ON s.id = a.student_id
     JOIN att.classes c ON c.id = s.class_id
     JOIN att.guardians g ON g.id = ml.guardian_id
     WHERE c.school_id = $1
     ORDER BY ml.id DESC LIMIT 150`,
    [s.sid]
  );

  return (
    <>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 6px' }}>WhatsApp Message Log</h1>
          <p className="muted" style={{ margin: 0 }}>
            Audit trail of automated WhatsApp attendance alerts dispatched to parents.
          </p>
        </div>
        <form action={retryFailed}>
          <button type="submit" disabled={Number(stats.failed) === 0}>
            ↻ Retry Failed ({stats.failed})
          </button>
        </form>
      </div>

      {sp.ok && <div className="msg">✓ {sp.ok}</div>}
      {sp.err && <div className="msg err">✕ {sp.err}</div>}

      {/* Metric Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ marginBottom: 0, padding: '16px 20px' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
            Delivered (7 Days)
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>
            {stats.sent}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 20px' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
            Failed Deliveries
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>
            {stats.failed}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '16px 20px' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
            Queued in Pipeline
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--amber)', marginTop: 4 }}>
            {stats.queued}
          </div>
        </div>
      </div>

      {/* Message Log Table */}
      <div className="card">
        <h2>
          <span>Recent Transmissions</span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            Latest {rows.length} messages
          </span>
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date &amp; Session</th>
                <th>Class</th>
                <th>Student</th>
                <th>Attendance</th>
                <th>Parent WhatsApp</th>
                <th>Delivery Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{r.d}</span>
                    <span className="muted" style={{ marginLeft: 6 }}>
                      ({r.session})
                    </span>
                  </td>
                  <td>{r.class_name}</td>
                  <td style={{ fontWeight: 600 }}>{r.student}</td>
                  <td>
                    <span className={`badge ${r.att_status === 'P' ? 'ok' : 'bad'}`}>
                      {r.att_status === 'P' ? 'Present' : 'Absent'}
                    </span>
                  </td>
                  <td>{r.phone}</td>
                  <td>
                    <span
                      className={`badge ${
                        r.status === 'sent' ? 'ok' : r.status === 'failed' ? 'bad' : 'wait'
                      }`}
                    >
                      {r.status === 'sent' ? '● Sent' : r.status === 'failed' ? '✕ Failed' : '◌ Queued'}
                    </span>
                    {r.error && (
                      <div className="muted" style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                        {r.error}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    No messages recorded in the dispatch log yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
