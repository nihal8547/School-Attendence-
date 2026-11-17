import { getData } from '@/lib/api';
import { addRemark, deleteRemark } from '@/lib/academic2-actions';
import { moduleRole, ModuleHead, type ModProps } from './ModuleShell';
import Icon from '@/components/Icon';

const ICON: Record<string, string> = { achievement: 'award', behavior: 'pin', general: 'note' };

export default async function RemarksView({ role, searchParams }: ModProps) {
  await moduleRole(role);
  const { classes, classId, students, rows } = await getData<{
    classes: { id: number; name: string }[]; classId: number;
    students: { id: number; roll_no: number; name: string }[];
    rows: { id: number; student: string; kind: string; note: string; created: string; by: string | null }[];
  }>('remarks', { class: searchParams.class });
  return (
    <>
      <ModuleHead title="Remarks & Achievements" intro="Note a student's achievement, behaviour or any remark. Send it to the parent if you want." searchParams={searchParams} classes={classes} classId={classId} />
      {classId > 0 && (
        <>
          <form action={addRemark} className="card">
            <input type="hidden" name="class_id" value={classId} />
            <h2>New remark</h2>
            <div className="row filters">
              <label>Student
                <select name="student_id" required>{students.map((s) => <option key={s.id} value={s.id}>{s.roll_no}. {s.name}</option>)}</select>
              </label>
              <label>Type
                <select name="kind" defaultValue="general"><option value="achievement">Achievement</option><option value="behavior">Behaviour</option><option value="general">General</option></select>
              </label>
            </div>
            <label style={{ marginTop: 12 }}>Remark<textarea name="note" rows={3} required maxLength={500} /></label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
              <label className="check-row"><input type="checkbox" name="notify" /> Send to parent on WhatsApp</label>
              <button type="submit">Save remark</button>
            </div>
          </form>
          <div className="tile-grid">
            {rows.map((r) => (
              <div className="tile" key={r.id}>
                <div className="tile-top">
                  <div className="avatar" style={{ fontSize: 18 }}><Icon n={ICON[r.kind] ?? 'note'} size={20} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tile-title">{r.student}</div>
                    <div className="tile-sub">{r.created}{r.by ? ` · ${r.by}` : ''}</div>
                  </div>
                </div>
                <div style={{ fontSize: 14.5, whiteSpace: 'pre-wrap' }}>{r.note}</div>
                <form action={deleteRemark}><input type="hidden" name="id" value={r.id} /><button type="submit" className="danger" style={{ padding: '6px 12px' }}>Remove</button></form>
              </div>
            ))}
            {!rows.length && <div className="empty">No remarks yet for this class.</div>}
          </div>
        </>
      )}
    </>
  );
}
