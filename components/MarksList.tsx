import Link from 'next/link';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureAcademicTables } from '@/lib/academic';
import { createExam } from '@/lib/academic-actions';
import { todayIST } from '@/lib/n8n';
import ClassPicker from './ClassPicker';

export default async function MarksList({
  role,
  searchParams,
}: {
  role: 'admin' | 'teacher';
  searchParams: { class?: string; ok?: string; err?: string };
}) {
  const s = await requireRole(role);
  await ensureAcademicTables();
  const base = role === 'admin' ? '/admin' : '/teacher';
  const classes =
    role === 'admin'
      ? await q(`SELECT id, name FROM att.classes ORDER BY name`)
      : await q(`SELECT id, name FROM att.classes WHERE teacher_id = $1 ORDER BY name`, [s.uid]);

  if (!classes.length) {
    return (
      <div className="card">
        <h1>Mark Sheets</h1>
        <div className="msg err">No class available yet.</div>
      </div>
    );
  }

  const classId = classes.find((c) => String(c.id) === searchParams.class)?.id ?? classes[0].id;
  const exams = await q(
    `SELECT e.id, e.name, to_char(e.exam_date, 'DD Mon YYYY') AS date_label,
            (SELECT COUNT(*) FROM att.exam_subjects x WHERE x.exam_id = e.id) AS subjects,
            (SELECT COUNT(DISTINCT m.student_id) FROM att.marks m WHERE m.exam_id = e.id) AS students_marked
     FROM att.exams e WHERE e.class_id = $1 ORDER BY e.exam_date DESC NULLS LAST, e.id DESC`,
    [classId]
  );

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Mark Sheets</h1>
        <p className="muted" style={{ margin: 0 }}>Create an exam, enter subject-wise marks and view the class result with total, percentage and rank.</p>
      </div>

      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}

      <div className="card">
        <ClassPicker classes={classes} value={classId} />
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>New exam</h2>
        <form action={createExam} className="row">
          <input type="hidden" name="class_id" value={classId} />
          <input type="hidden" name="base" value={base} />
          <label>
            Exam name
            <input name="name" placeholder="e.g. Term 1 Exam" required maxLength={80} />
          </label>
          <label>
            Date
            <input type="date" name="exam_date" defaultValue={todayIST()} />
          </label>
          <label style={{ flex: 2 }}>
            Subjects (comma separated)
            <input name="subjects" placeholder="English, Malayalam, Maths, Science, Social" required />
          </label>
          <label>
            Max marks / subject
            <input type="number" name="max_marks" defaultValue={100} min={1} max={1000} />
          </label>
          <button type="submit">Create &amp; Enter Marks</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Exams</h2>
        {!exams.length ? (
          <p className="muted">No exams yet for this class.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Exam</th><th>Date</th><th>Subjects</th><th>Students marked</th><th /></tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td><strong>{e.name}</strong></td>
                    <td>{e.date_label || '—'}</td>
                    <td>{e.subjects}</td>
                    <td>{e.students_marked}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="btn ghost" href={`${base}/marks/${e.id}`}>Open</Link>
                    </td>
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
