import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import LiveRefresh from '@/components/LiveRefresh';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

type Row = { id: number; name: string; teacher: string | null; students: string; m_p: string; m_a: string; a_p: string; a_a: string };

export default async function Dashboard() {
  await requireRole('admin');
  const d = await getData<{
    today: string;
    tot: { students: string; classes: string; teachers: string; wa_connected: string };
    classes: Row[];
    msg: { sent: string; failed: string; queued: string };
    recent: { student: string; class_name: string; session: string; status: string; at: string; by: string | null }[];
    teachers: { name: string; wa_status: string }[];
  }>('dashboard');
  const n = (v: string | number) => Number(v) || 0;
  const marked = (c: Row, s: 'm' | 'a') => n(c[`${s}_p` as 'm_p']) + n(c[`${s}_a` as 'm_a']);
  const totalAbsentM = d.classes.reduce((a, c) => a + n(c.m_a), 0);
  const totalAbsentA = d.classes.reduce((a, c) => a + n(c.a_a), 0);
  const pendingM = d.classes.filter((c) => n(c.students) > 0 && marked(c, 'm') === 0).length;
  const pendingA = d.classes.filter((c) => n(c.students) > 0 && marked(c, 'a') === 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Live Dashboard</h1>
          <p className="muted" style={{ margin: 0 }}><span className="live-dot" />Live &middot; {d.today} &middot; auto-refreshes every 30s</p>
        </div>
        <LiveRefresh seconds={30} />
      </div>

      <div className="dash-grid">
        <div className="dash-stat"><div className="k">Students</div><div className="v">{d.tot.students}</div></div>
        <div className="dash-stat"><div className="k">Absent (morning)</div><div className="v bad">{totalAbsentM}</div></div>
        <div className="dash-stat"><div className="k">Absent (afternoon)</div><div className="v bad">{totalAbsentA}</div></div>
        <div className="dash-stat"><div className="k">Pending (morning)</div><div className={`v ${pendingM ? 'warn' : 'ok'}`}>{pendingM}</div></div>
        <div className="dash-stat"><div className="k">Pending (afternoon)</div><div className={`v ${pendingA ? 'warn' : 'ok'}`}>{pendingA}</div></div>
        <div className="dash-stat"><div className="k">WhatsApp online</div><div className="v">{d.tot.wa_connected}/{d.tot.teachers}</div></div>
      </div>

      <div className="dash-grid">
        <div className="dash-stat"><div className="k">Messages sent (24h)</div><div className="v ok">{d.msg.sent}</div></div>
        <div className="dash-stat"><div className="k">Queued</div><div className="v warn">{d.msg.queued}</div></div>
        <div className="dash-stat"><div className="k">Failed</div><div className={`v ${n(d.msg.failed) ? 'bad' : ''}`}>{d.msg.failed}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Today by class</h3>
        <table>
          <thead><tr><th>Class</th><th>Teacher</th><th>Students</th><th>Morning</th><th>Afternoon</th></tr></thead>
          <tbody>
            {d.classes.map((c) => {
              const cell = (s: 'm' | 'a') => {
                const m = marked(c, s);
                if (!m) return <span className="badge wait"><Icon n="clock" /> Pending</span>;
                const abs = n(c[`${s}_a` as 'm_a']);
                const pct = Math.round((n(c[`${s}_p` as 'm_p']) / m) * 100);
                return (
                  <div>
                    <div className="bar"><span style={{ width: `${pct}%` }} /></div>
                    <small className="muted">{c[`${s}_p` as 'm_p']} present &middot; {abs} absent</small>
                  </div>
                );
              };
              return (
                <tr key={c.id}>
                  <td data-label="Class"><strong>{c.name}</strong></td>
                  <td data-label="Teacher">{c.teacher ?? '-'}</td>
                  <td data-label="Students">{c.students}</td>
                  <td data-label="Morning">{cell('m')}</td>
                  <td data-label="Afternoon">{cell('a')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="dash-two">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent marking</h3>
          {d.recent.length === 0 && <p className="muted">No attendance marked yet today.</p>}
          {d.recent.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line-light)' }}>
              <span>
                <Icon n={r.status === 'P' ? 'check' : 'x'} /> {r.student} <small className="muted">{r.class_name} &middot; {r.session}</small>
              </span>
              <small className="muted">{r.at}</small>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Teacher WhatsApp</h3>
          {d.teachers.map((t) => (
            <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line-light)' }}>
              <span>{t.name}</span>
              <span className={`badge ${t.wa_status === 'connected' ? 'ok' : 'bad'}`}>{t.wa_status === 'connected' ? 'Connected' : 'Offline'}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
