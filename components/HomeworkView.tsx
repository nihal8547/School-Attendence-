import { q } from '@/lib/db';
import { addHomework, deleteHomework } from '@/lib/academic2-actions';
import { fmtDate } from '@/lib/format';
import { todayIST } from '@/lib/n8n';
import { moduleContext, ModuleHead, type ModProps } from './ModuleShell';

export default async function HomeworkView({ role, searchParams }: ModProps) {
  const { classes, classId } = await moduleContext(role, 'homework', searchParams);
  const rows = classId
    ? await q<{ id: number; subject: string; title: string; details: string; due: string | null; created: string }>(
        `SELECT id, subject, title, details, to_char(due_date, 'YYYY-MM-DD') AS due, to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon') AS created
         FROM att.homework WHERE class_id = $1 ORDER BY created_at DESC LIMIT 60`,
        [classId]
      )
    : [];
  const today = todayIST();
  return (
    <>
      <ModuleHead title="Homework" intro="Give homework by subject. Parents can get it on WhatsApp." searchParams={searchParams} classes={classes} classId={classId} />
      {classId > 0 && (
        <>
          <form action={addHomework} className="card">
            <input type="hidden" name="class_id" value={classId} />
            <h2>New homework</h2>
            <div className="row filters">
              <label>Subject<input name="subject" required maxLength={60} placeholder="Mathematics" /></label>
              <label>Title<input name="title" required maxLength={120} placeholder="Exercise 4.2, Q1–5" /></label>
              <label>Due date<input name="due_date" type="date" min={today} /></label>
            </div>
            <label style={{ marginTop: 12 }}>Details (optional)<textarea name="details" rows={3} maxLength={1000} /></label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
              <label className="check-row"><input type="checkbox" name="notify" /> Send to parents on WhatsApp</label>
              <button type="submit">Add homework</button>
            </div>
          </form>
          <div className="tile-grid">
            {rows.map((h) => (
              <div className="tile" key={h.id}>
                <div className="tile-top">
                  <div className="avatar sq" style={{ fontSize: 11 }}>{h.subject.slice(0, 3).toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tile-title" style={{ whiteSpace: 'normal' }}>{h.title}</div>
                    <div className="tile-sub">{h.subject} · given {h.created}</div>
                  </div>
                  {h.due && <span className={`badge ${h.due < today ? 'bad' : 'ok'}`}>Due {fmtDate(h.due)}</span>}
                </div>
                {h.details && <div style={{ fontSize: 14, color: '#475569', whiteSpace: 'pre-wrap' }}>{h.details}</div>}
                <form action={deleteHomework}><input type="hidden" name="id" value={h.id} /><button type="submit" className="danger" style={{ padding: '6px 12px' }}>Remove</button></form>
              </div>
            ))}
            {!rows.length && <div className="empty">No homework yet for this class.</div>}
          </div>
        </>
      )}
    </>
  );
}
