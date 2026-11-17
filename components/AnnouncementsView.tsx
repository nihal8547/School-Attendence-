import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { sendAnnouncement } from '@/lib/announce-actions';
import ConfirmButton from './ConfirmButton';
import Icon from '@/components/Icon';

export default async function AnnouncementsView({ role, searchParams }: { role: 'admin' | 'teacher'; searchParams: { ok?: string; err?: string } }) {
  await requireRole(role);
  const d = await getData<{
    classes: { id: number; name: string }[]; counts: [number, number][]; total: number;
    history: { id: number; title: string; audience: string; created: string; recipients: number; sent: string; failed: string; pending: string }[];
  }>('announcements');
  const { classes, total, history } = d;
  const cnt = new Map<number, number>(d.counts);

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Announcements</h1>
        <p className="muted" style={{ margin: 0 }}>Send a notice to parents on WhatsApp: PTA meeting, exam dates, school events.</p>
      </div>
      {searchParams.ok && <div className="msg"><Icon n="check" /> {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err"><Icon n="x" /> {searchParams.err}</div>}

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
