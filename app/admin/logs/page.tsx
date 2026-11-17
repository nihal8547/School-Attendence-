import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { retryFailed } from '../actions';

export const dynamic = 'force-dynamic';

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; page?: string }>;
}) {
  await requireRole('admin');
  const sp = await searchParams;
  const { stats, rows, page, hasMore } = await getData<{ stats: any; rows: any[]; page: number; hasMore: boolean }>('admin-logs', { page: sp.page });

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
            Page {page}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          {page > 1 ? <a className="btn ghost" href={`/admin/logs?page=${page - 1}`}>← Newer</a> : <span />}
          {hasMore ? <a className="btn ghost" href={`/admin/logs?page=${page + 1}`}>Older →</a> : <span />}
        </div>
      </div>
    </>
  );
}
