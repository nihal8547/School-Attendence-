import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { addStudent, importStudents, removeStudent } from '../actions';
import Icon from '@/components/Icon';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; page?: string; ok?: string; err?: string }>;
}) {
  await requireRole('admin');
  const sp = await searchParams;
  const { classes, classId, students, total, page, pages } = await getData<{
    classes: { id: number; name: string }[]; classId: number; students: any[]; total: number; page: number; pages: number;
  }>('students', { class: sp.class, page: sp.page });

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1>Student Roster</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage enrolled students and guardian contact details for automated WhatsApp attendance alerts.
        </p>
      </div>

      {sp.ok && <div className="msg"><Icon n="check" /> {sp.ok}</div>}
      {sp.err && <div className="msg err"><Icon n="x" /> {sp.err}</div>}
      {!classes.length && (
        <div className="msg err">
          Please create at least one class first under Teachers &amp; Classes.
        </div>
      )}

      {/* Class Selector Card */}
      <div className="card">
        <form className="row" method="get">
          <label>
            Select Class
            <select name="class" defaultValue={classId}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="ghost" type="submit" style={{ minWidth: 90 }}>
            View Students
          </button>
        </form>
      </div>

      {/* Add Single Student */}
      <div className="card">
        <h2>Add Single Student</h2>
        <form action={addStudent} className="row">
          <input type="hidden" name="class_id" value={classId} />
          <label style={{ maxWidth: 100 }}>
            Roll No
            <input name="roll_no" type="number" min={1} placeholder="1" required />
          </label>
          <label>
            Student Full Name
            <input name="name" placeholder="Ahmed Ali" required />
          </label>
          <label>
            Parent / Guardian Name
            <input name="guardian_name" placeholder="Mr. Ali" />
          </label>
          <label>
            Parent WhatsApp Phone
            <input name="phone" placeholder="98xxxxxxxx" required />
          </label>
          <button type="submit">Add Student</button>
        </form>
      </div>

      {/* Bulk CSV Import */}
      <div className="card">
        <h2>Bulk Import via CSV</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Enter one student per line in the format: <code>roll_no,student_name,parent_name,whatsapp_number</code>
        </p>
        <form action={importStudents} className="stack">
          <input type="hidden" name="class_id" value={classId} />
          <textarea
            name="csv"
            placeholder={'1,Ahmed Ali,Mr. Ali,9876543210\n2,Fatima Khan,Mrs. Khan,9123456780\n3,Zaid Hassan,Mr. Hassan,9988776655'}
          />
          <button type="submit" style={{ alignSelf: 'flex-start' }}>
            Import Students
          </button>
        </form>
      </div>

      {/* Students Table */}
      <div className="card">
        <h2>
          <span>Class Roster</span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            {total} students enrolled
          </span>
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Roll</th>
                <th>Student Name</th>
                <th>Guardian &amp; WhatsApp</th>
                <th style={{ width: 100, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="student-roll">#{s.roll_no}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.guardians || <span className="muted">— None —</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <form action={removeStudent} style={{ display: 'inline-block' }}>
                      <input type="hidden" name="student_id" value={s.id} />
                      <input type="hidden" name="class_id" value={classId} />
                      <button
                        className="ghost"
                        type="submit"
                        style={{ padding: '5px 10px', fontSize: 12, color: 'var(--red)' }}
                      >
                        Remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!students.length && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    No students found in this class yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            {page > 1 ? <a className="btn ghost" href={`/admin/students?class=${classId}&page=${page - 1}`}><Icon n="arrow-left" /> Previous</a> : <span />}
            <span className="muted">Page {page} of {pages}</span>
            {page < pages ? <a className="btn ghost" href={`/admin/students?class=${classId}&page=${page + 1}`}>Next <Icon n="arrow-right" /></a> : <span />}
          </div>
        )}
      </div>
    </>
  );
}
