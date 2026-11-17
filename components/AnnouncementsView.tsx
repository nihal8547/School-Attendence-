import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { classesFor } from '@/lib/access';
import { sendAnnouncement } from '@/lib/announce-actions';
import ConfirmButton from './ConfirmButton';

export default async function AnnouncementsView({ role, searchParams }: { role: 'admin' | 'teacher'; searchParams: { ok?: string; err?: string } }) {
  const s = await requireRole(role);
  await ensureSchema();
  const classes = await classesFor(s);
  const counts = await q<{ class_id: number; n: string }>(
    `SELECT st.class_id, COUNT(DISTINCT g.phone) AS n FROM att.guardians g JOIN att.students st ON st.id = g.student_id AND st.active
     WHERE g.opt_in GROUP BY st.class_id`
  );
  const cnt = new Map(counts.map((c) => [c.class_id, Number(c.n)]));
  const [{ total }] = await q<{ total: string }>(
    `SELECT COUNT(DISTINCT g.phone) AS total FROM att.guardians g JOIN att.students st ON st.id = g.student_id AND st.active WHERE g.opt_in`
  );

  const history = await q<{ id: number; title: string; audience: string; created: string; recipients: number; sent: string; failed: string; pending: string }>(
    `SELECT a.id, a.title,
            CASE WHEN a.all_school THEN 'Whole school' ELSE COALESCE('Class ' || c.name, 'Class') END AS audience,
            to_char(a.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM') AS created,
            a.recipients,
            (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='sent') AS sent,
            (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='failed') AS failed,
            (SELECT COUNT(*) FROM att.notice_log n WHERE n.kind='announcement' AND n.ref_id = a.id AND n.status='queued') AS pending
     FROM att.announcements a LEFT JOIN att.classes c ON c.id = a.class_id
     WHERE ($1 = 'admin' OR a.created_by = $2)
     ORDER BY a.id DESC LIMIT 30`,
    [role, s.uid]
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Announcements</h1>
        <p className="muted" style={{ margin: 0 }}>Send a notice to parents on WhatsApp: PTA meeting, exam dates, school events.</p>
      </div>
      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}

      <form action={sendAnnouncement} className="card">
        <h2>New announcement</h2>
        {!classes.length && role === 'teacher' ? (
          <div className="msg err">No class is assigned to you yet.</div>
        ) : (
          <div className="stack" style={{ display: 'grid', gap: 14 }}>
            <label>
              Send to
              <select name="audience" defaultValue={role === 'admin' ? 'all' : String(classes[0]?.id)}>
                {role === 'admin' && <option value="all">Whole school ({total} parents)</option>}
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    Class {c.name} ({cnt.get(c.id) ?? 0} parents)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Title
              <input name="title" placeholder="e.g. PTA meeting on Saturday" required maxLength={80} />
            </label>
            <label>
              Message
              <textarea name="body" rows={5} required maxLength={1000} placeholder="Write the message parents will receive…" />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <ConfirmButton message="Send this announcement to the parents on WhatsApp?">Send on WhatsApp</ConfirmButton>
            </div>
          </div>
        )}
        <p className="hint">Each parent number gets the message once. It is sent from the class teacher&apos;s own WhatsApp, with a short delay between messages.</p>
      </form>

      <div className="card">
        <h2>Sent announcements</h2>
        {!history.length ? (
          <p className="muted">Nothing sent yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>When</th><th>Title</th><th>Audience</th><th>Parents</th><th>Sent</th><th>Failed</th><th>Waiting</th></tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.created}</td>
                    <td><strong>{h.title}</strong></td>
                    <td>{h.audience}</td>
                    <td>{h.recipients}</td>
                    <td>{h.sent}</td>
                    <td>{Number(h.failed) ? <span className="badge bad">{h.failed}</span> : 0}</td>
                    <td>{h.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
