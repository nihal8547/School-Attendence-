import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { addStudent, importStudents, removeStudent } from '../actions';

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ class?: string; ok?: string; err?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const classes = await q(`SELECT id, name FROM att.classes ORDER BY name`);
  const classId = Number(sp.class) || classes[0]?.id || 0;
  const students = classId
    ? await q(
        `SELECT s.id, s.roll_no, s.name,
                COALESCE(string_agg(g.name || ' (' || g.phone || ')', ', '), '') AS guardians
         FROM att.students s LEFT JOIN att.guardians g ON g.student_id = s.id
         WHERE s.class_id = $1 AND s.active GROUP BY s.id ORDER BY s.roll_no, s.name`,
        [classId]
      )
    : [];
  return (
    <>
      <h1>Students</h1>
      {sp.ok && <div className="msg">{sp.ok}</div>}
      {sp.err && <div className="msg err">{sp.err}</div>}
      {!classes.length && <div className="msg err">Create a class first (Teachers &amp; Classes).</div>}

      <form className="card row" method="get">
        <label>Class
          <select name="class" defaultValue={classId}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button className="ghost" type="submit">Show</button>
      </form>

      <div className="card">
        <h2>Add one student</h2>
        <form action={addStudent} className="row">
          <input type="hidden" name="class_id" value={classId} />
          <label>Roll no<input name="roll_no" type="number" min={0} style={{ width: 80 }} /></label>
          <label>Student name<input name="name" required /></label>
          <label>Parent name<input name="guardian_name" /></label>
          <label>Parent WhatsApp<input name="phone" placeholder="98xxxxxxxx" required /></label>
          <button type="submit">Add</button>
        </form>
      </div>

      <div className="card">
        <h2>Bulk import</h2>
        <p className="muted">One student per line: <code>roll_no,student_name,parent_name,whatsapp_number</code></p>
        <form action={importStudents} className="stack">
          <input type="hidden" name="class_id" value={classId} />
          <textarea name="csv" placeholder={'1,Ahmed Ali,Mr. Ali,9876543210\n2,Fatima K,Mrs. Khan,9123456780'} />
          <button type="submit">Import</button>
        </form>
      </div>

      <div className="card">
        <h2>Class list ({students.length})</h2>
        <table>
          <thead><tr><th>Roll</th><th>Student</th><th>Parent WhatsApp</th><th /></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.roll_no}</td><td>{s.name}</td><td>{s.guardians}</td>
                <td>
                  <form action={removeStudent}>
                    <input type="hidden" name="student_id" value={s.id} />
                    <input type="hidden" name="class_id" value={classId} />
                    <button className="ghost" type="submit">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
