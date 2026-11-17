import { getData } from '@/lib/api';
import { addLeave, decideLeave, deleteLeave } from '@/lib/academic2-actions';
import { fmtDate } from '@/lib/format';
import { moduleRole, ModuleHead, type ModProps } from './ModuleShell';

export default async function LeavesView({ role, searchParams }: ModProps) {
  await moduleRole(role);
  const { classes, classId, students, rows, today } = await getData<{
    classes: { id: number; name: string }[]; classId: number; today: string;
    students: { id: number; roll_no: number; name: string }[];
    rows: { id: number; student: string; f: string; t: string; reason: string; status: string }[];
  }>('leaves', { class: searchParams.class });
  return (
    <>
      <ModuleHead title="Leave Requests" intro="Record a leave the parent told you about, approve or reject it, and inform the parent on WhatsApp." searchParams={searchParams} classes={classes} classId={classId} />
      {classId > 0 && (
        <>
          <form action={addLeave} className="card">
            <input type="hidden" name="class_id" value={classId} />
            <h2>New leave request</h2>
            <div className="row filters">
              <label>Student
                <select name="student_id" required>{students.map((s) => <option key={s.id} value={s.id}>{s.roll_no}. {s.name}</option>)}</select>
              </label>
              <label>From<input type="date" name="from_date" defaultValue={today} required /></label>
              <label>To<input type="date" name="to_date" defaultValue={today} /></label>
            </div>
            <label style={{ marginTop: 12 }}>Reason<input name="reason" maxLength={300} placeholder="Fever, family function…" /></label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><button type="submit">Record leave</button></div>
          </form>
          <div className="card">
            <h2>Requests</h2>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Student</th><th>Dates</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td data-label="Student"><strong>{l.student}</strong></td>
                      <td data-label="Dates">{l.f === l.t ? fmtDate(l.f) : `${fmtDate(l.f)} – ${fmtDate(l.t)}`}</td>
                      <td data-label="Reason">{l.reason || '—'}</td>
                      <td data-label="Status"><span className={`badge ${l.status === 'approved' ? 'ok' : l.status === 'rejected' ? 'bad' : ''}`}>{l.status}</span></td>
                      <td>
                        <details>
                          <summary style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>Decide</summary>
                          <form action={decideLeave} style={{ display: 'grid', gap: 8, marginTop: 8, minWidth: 220 }}>
                            <input type="hidden" name="id" value={l.id} />
                            <label className="check-row"><input type="checkbox" name="notify" defaultChecked /> Tell parent on WhatsApp</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="submit" name="decision" value="approved">Approve</button>
                              <button type="submit" name="decision" value="rejected" className="danger">Reject</button>
                            </div>
                          </form>
                          <form action={deleteLeave} style={{ marginTop: 8 }}><input type="hidden" name="id" value={l.id} /><button type="submit" className="ghost" style={{ padding: '6px 12px' }}>Delete record</button></form>
                        </details>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={5} className="muted" style={{ textAlign: 'center' }}>No leave requests.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
