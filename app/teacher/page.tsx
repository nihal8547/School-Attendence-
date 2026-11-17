import Link from 'next/link';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

function fmtPhone(p?: string | null) {
  if (!p) return '—';
  const m = /^91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export default async function TeacherDashboard() {
  const s = await requireRole('teacher');
  const { today, waStatus, me, classes, todayRows, msgs, roster } = await getData<{
    today: string; waStatus: string; me: any; classes: any[]; todayRows: any[]; msgs: any; roster: any[];
  }>('teacher-home');

  const stat = (classId: number, session: string) => todayRows.find((r) => r.class_id === classId && r.session === session);
  const initial = (me?.name || s.name || 'T').charAt(0).toUpperCase();

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Teacher Dashboard</h1>
        <p className="muted" style={{ margin: 0 }}>Welcome, {me?.name || s.name}. Here is your profile, class and WhatsApp details.</p>
      </div>

      {waStatus !== 'connected' && (
        <div className="msg err">
          ⚠️ Your WhatsApp device is not connected, so parent messages cannot be delivered.{' '}
          <Link href="/teacher/whatsapp" style={{ fontWeight: 600, color: 'inherit' }}>Connect WhatsApp →</Link>
        </div>
      )}

      <div className="dash-grid">
        <div className="card">
          <h2>My Profile</h2>
          <div className="profile-head">
            <div className="profile-avatar">{initial}</div>
            <div>
              <div className="profile-name">{me?.name}</div>
              <span className="badge ok">Class Teacher</span>
            </div>
          </div>
          <dl className="kv">
            <dt>Login email</dt><dd>{me?.email}</dd>
            <dt>Mobile (WhatsApp)</dt><dd>{fmtPhone(me?.phone)}</dd>
            <dt>Assigned classes</dt><dd>{classes.length ? classes.map((c) => c.name).join(', ') : 'None yet'}</dd>
            <dt>Joined</dt><dd>{me?.joined}</dd>
          </dl>
          <p className="muted" style={{ marginBottom: 0 }}>These details are set by the school admin. Ask the admin to change them.</p>
        </div>

        <div className="card">
          <h2>WhatsApp Details</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd><span className={`badge ${waStatus === 'connected' ? 'ok' : 'bad'}`}>{waStatus === 'connected' ? '● Connected' : '○ Disconnected'}</span></dd>
            <dt>Sending number</dt><dd>{fmtPhone(me?.phone)}</dd>
            <dt>Device ID</dt><dd>{me?.instance_name || `att_teacher_${s.uid}`}</dd>
            <dt>Messages today</dt>
            <dd>{msgs.sent} sent · {msgs.failed} failed · {msgs.queued} queued</dd>
          </dl>
          <div className="row" style={{ marginTop: 14 }}>
            <Link className="btn" href="/teacher/whatsapp">{waStatus === 'connected' ? 'Manage WhatsApp' : 'Connect WhatsApp'}</Link>
            <Link className="btn ghost-link" href="/teacher/attendance">Mark Attendance</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>My Classes · Today ({today})</h2>
        {!classes.length && <div className="msg err">No class is assigned to you yet. Please contact the school administrator.</div>}
        {!!classes.length && (
          <table>
            <thead>
              <tr><th>Class</th><th>Students</th><th>Parents added</th><th>Morning</th><th>Afternoon</th></tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const cell = (sess: string) => {
                  const r = stat(c.id, sess);
                  return r ? <span className="badge ok">✓ {r.present} P · {r.absent} A</span> : <span className="badge wait">Not marked</span>;
                };
                return (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td><td>{c.students}</td><td>{c.parents}</td>
                    <td>{cell('morning')}</td><td>{cell('afternoon')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {classes.map((c) => (
        <details className="card" key={c.id}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Class {c.name} · Students &amp; parent numbers ({c.students})</summary>
          <table style={{ marginTop: 12 }}>
            <thead><tr><th>Roll</th><th>Student</th><th>Parent WhatsApp</th></tr></thead>
            <tbody>
              {roster.filter((r) => r.class_id === c.id).map((r, i) => (
                <tr key={i}><td>{r.roll_no}</td><td>{r.name}</td><td>{r.parents || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </>
  );
}
