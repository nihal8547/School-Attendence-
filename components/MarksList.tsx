import Link from 'next/link';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { createExam } from '@/lib/academic-actions';
import ClassPicker from './ClassPicker';

export default async function MarksList({
  role,
  searchParams,
}: {
  role: 'admin' | 'teacher';
  searchParams: { class?: string; ok?: string; err?: string };
}) {
  await requireRole(role);
  const base = role === 'admin' ? '/admin' : '/teacher';
  const { classes, classId, exams, today } = await getData<{ classes: { id: number; name: string }[]; classId: number; exams: any[]; today: string }>('marks-list', { class: searchParams.class });

  if (!classes.length) {
    return (
      <div className="card">
        <h1>Mark Sheets</h1>
        <div className="msg err">No class available yet.</div>
      </div>
    );
  }

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
            <input type="date" name="exam_date" defaultValue={today} />
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
