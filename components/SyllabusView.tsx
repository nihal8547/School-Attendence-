import { q } from '@/lib/db';
import { addChapters, setTopicStatus, deleteTopic } from '@/lib/academic2-actions';
import { fmtDate } from '@/lib/format';
import { moduleContext, ModuleHead, type ModProps } from './ModuleShell';

type T = { id: number; subject: string; chapter: string; status: 'pending' | 'in_progress' | 'done'; done_on: string | null };

export default async function SyllabusView({ role, searchParams }: ModProps) {
  const { classes, classId } = await moduleContext(role, 'syllabus', searchParams);
  const topics = classId
    ? await q<T>(`SELECT id, subject, chapter, status, to_char(completed_on, 'YYYY-MM-DD') AS done_on FROM att.syllabus_topics WHERE class_id = $1 ORDER BY subject, position, id`, [classId])
    : [];
  const subjects = [...new Set(topics.map((t) => t.subject))];
  return (
    <>
      <ModuleHead title="Syllabus & Lesson Plan" intro="List chapters per subject and track how much has been covered." searchParams={searchParams} classes={classes} classId={classId} />
      {classId > 0 && (
        <>
          <form action={addChapters} className="card">
            <input type="hidden" name="class_id" value={classId} />
            <h2>Add chapters</h2>
            <label>Subject<input name="subject" required maxLength={60} list="subj" placeholder="Science" /></label>
            <datalist id="subj">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            <label style={{ marginTop: 12 }}>Chapters (one per line)<textarea name="chapters" rows={4} required placeholder={'1. Food and nutrition\n2. Components of food'} /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="submit">Add chapters</button></div>
          </form>
          {subjects.map((sub) => {
            const list = topics.filter((t) => t.subject === sub);
            const done = list.filter((t) => t.status === 'done').length;
            const pct = Math.round((done / list.length) * 100);
            return (
              <div className="card" key={sub}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0 }}>{sub}</h2>
                  <span className="muted">{done}/{list.length} done · {pct}%</span>
                </div>
                <div className="pct-bar" style={{ margin: '10px 0 14px' }}><span style={{ width: `${pct}%` }} /></div>
                <div className="table-wrapper">
                  <table className="no-stack">
                    <tbody>
                      {list.map((t) => (
                        <tr key={t.id}>
                          <td style={{ width: '100%' }}>{t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🟡' : '⚪'} {t.chapter}{t.done_on && <span className="muted"> · {fmtDate(t.done_on)}</span>}</td>
                          <td>
                            <form action={setTopicStatus} style={{ display: 'flex', gap: 6 }}>
                              <input type="hidden" name="id" value={t.id} />
                              <select name="status" defaultValue={t.status} aria-label="Status"><option value="pending">Not started</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
                              <button type="submit" className="ghost" style={{ padding: '6px 12px' }}>Save</button>
                            </form>
                          </td>
                          <td><form action={deleteTopic}><input type="hidden" name="id" value={t.id} /><button type="submit" className="danger" style={{ padding: '6px 10px' }}>✕</button></form></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {!subjects.length && <div className="empty">No chapters yet for this class.</div>}
        </>
      )}
    </>
  );
}
