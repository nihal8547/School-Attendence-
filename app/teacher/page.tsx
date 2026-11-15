import Link from 'next/link';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { getLiveWaStatus } from '@/lib/wa';
import { todayIST } from '@/lib/n8n';

export const dynamic = 'force-dynamic';

function fmtPhone(p?: string | null) {
  if (!p) return '—';
  const m = /^91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export default async function TeacherDashboard() {
  const s = await requireRole('teacher');
  const today = todayIST();
  const waStatus = await getLiveWaStatus(s.uid);

  const [me] = await q(
    `SELECT name, email, phone, instance_name, to_char(created_at, 'DD Mon YYYY') AS joined FROM att.users WHERE id = $1`,
    [s.uid]
  );

  const classes = await q(
    `SELECT c.id, c.name,
            (SELECT COUNT(*) FROM att.students st WHERE st.class_id = c.id AND st.active) AS students,
            (SELECT COUNT(*) FROM att.guardians g JOIN att.students st ON st.id = g.student_id WHERE st.class_id = c.id AND st.active) AS parents
     FROM att.classes c WHERE c.teacher_id = $1 ORDER BY c.name`,
    [s.uid]
  );

  const classIds = classes.map((c) => c.id);
  const todayRows = classIds.length
    ? await q(
        `SELECT st.class_id, a.session,
                COUNT(*) FILTER (WHERE a.status = 'P') AS present,
                COUNT(*) FILTER (WHERE a.status = 'A') AS absent
         FROM att.attendance a JOIN att.students st ON st.id = a.student_id
         WHERE st.class_id = ANY($1::int[]) AND a.att_date = $2::date
         GROUP BY st.class_id, a.session`,
        [classIds, today]
      )
    : [];

  const [msgs] = classIds.length
    ? await q(
        `SELECT COUNT(*) FILTER (WHERE ml.status = 'sent') AS sent,
                COUNT(*) FILTER (WHERE ml.status = 'failed') AS failed,
                COUNT(*) FILTER (WHERE ml.status = 'queued') AS queued
         FROM att.message_log ml
         JOIN att.attendance a ON a.id = ml.attendance_id
         JOIN att.students st ON st.id = a.student_id
         WHERE st.class_id = ANY($1::int[]) AND a.att_date = $2::date`,
        [classIds, today]
      )
    : [{ sent: 0, failed: 0, queued: 0 }];

  const roster = classIds.length
    ? await q(
        `SELECT st.class_id, st.roll_no, st.name,
                COALESCE(string_agg(COALESCE(g.name, 'Parent') || ' · ' || g.phone, ', '), '') AS parents
         FROM att.students st LEFT JOIN att.guardians g ON g.student_id = st.id
         WHERE st.class_id = ANY($1::int[]) AND st.active
         GROUP BY st.id ORDER BY st.roll_no, st.name`,
        [classIds]
      )
    : [];

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
