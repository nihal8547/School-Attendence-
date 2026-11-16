import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureAcademicTables } from '@/lib/academic';
import { saveMarks, deleteExam, sendMarksheet } from '@/lib/academic-actions';
import PrintButton from './PrintButton';
import ConfirmButton from './ConfirmButton';

function grade(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'E';
}

export default async function ExamSheet({
  role,
  examId,
  searchParams,
}: {
  role: 'admin' | 'teacher';
  examId: number;
  searchParams: { ok?: string; err?: string };
}) {
  const s = await requireRole(role);
  await ensureAcademicTables();
  const base = role === 'admin' ? '/admin' : '/teacher';

  const [exam] = await q(
    `SELECT e.id, e.name, e.class_id, c.name AS class_name, c.teacher_id, to_char(e.exam_date, 'DD Mon YYYY') AS date_label
     FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1`,
    [examId]
  );
  if (!exam || (role === 'teacher' && exam.teacher_id !== s.uid)) notFound();

  const subjects = await q<{ subject: string; max_marks: number }>(
    `SELECT subject, max_marks FROM att.exam_subjects WHERE exam_id = $1 ORDER BY position`,
    [examId]
  );
  const students = await q<{ id: number; roll_no: number; name: string }>(
    `SELECT id, roll_no, name FROM att.students WHERE class_id = $1 AND active ORDER BY roll_no, name`,
    [exam.class_id]
  );
  const markRows = await q<{ student_id: number; subject: string; marks: string }>(
    `SELECT student_id, subject, marks FROM att.marks WHERE exam_id = $1`,
    [examId]
  );
  const marks = new Map(markRows.map((m) => [`${m.student_id}_${m.subject}`, Number(m.marks)]));
  const maxTotal = subjects.reduce((a, x) => a + x.max_marks, 0);

  const results = students.map((st) => {
    const got = subjects.map((sub) => marks.get(`${st.id}_${sub.subject}`));
    const complete = got.every((g) => g !== undefined);
    const total = got.reduce<number>((a, g) => a + (g ?? 0), 0);
    return { ...st, complete, total, pct: maxTotal ? (total / maxTotal) * 100 : 0 };
  });
  const ranked = results.filter((r) => r.complete).sort((a, b) => b.total - a.total);
  const rankOf = new Map<number, number>();
  ranked.forEach((r, i) => rankOf.set(r.id, i > 0 && r.total === ranked[i - 1].total ? rankOf.get(ranked[i - 1].id)! : i + 1));

  return (
    <>
      <div style={{ marginBottom: 20 }} className="no-print">
        <Link href={`${base}/marks?class=${exam.class_id}`} className="muted">← All exams</Link>
        <h1 style={{ marginTop: 6 }}>{exam.name}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Class {exam.class_name}{exam.date_label ? ` · ${exam.date_label}` : ''} · {subjects.length} subjects · {maxTotal} total marks
        </p>
      </div>

      {searchParams.ok && <div className="msg no-print">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err no-print">✕ {searchParams.err}</div>}

      <form action={saveMarks} className="card no-print">
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="base" value={base} />
        <h2 style={{ marginTop: 0 }}>Enter marks</h2>
        {!students.length ? (
          <p className="muted">No active students in this class.</p>
        ) : (
          <div className="table-wrapper">
            <table className="marks-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  {subjects.map((sub) => (
                    <th key={sub.subject}>{sub.subject}<div className="muted" style={{ fontWeight: 400 }}>/ {sub.max_marks}</div></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.id}>
                    <td>{st.roll_no}</td>
                    <td>{st.name}</td>
                    {subjects.map((sub) => (
                      <td key={sub.subject}>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={sub.max_marks}
                          name={`m_${st.id}_${sub.subject}`}
                          defaultValue={marks.get(`${st.id}_${sub.subject}`) ?? ''}
                          aria-label={`${st.name} ${sub.subject}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={!students.length} style={{ minWidth: 160 }}>Save Marks</button>
        </div>
      </form>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>Result · Class {exam.class_name} · {exam.name}</h2>
          <PrintButton label="Print mark sheet" />
        </div>
        <div className="table-wrapper" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Roll</th><th>Student</th>
                {subjects.map((sub) => <th key={sub.subject}>{sub.subject}</th>)}
                <th>Total / {maxTotal}</th><th>%</th><th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td>{r.complete ? rankOf.get(r.id) : '—'}</td>
                  <td>{r.roll_no}</td>
                  <td>{r.name}</td>
                  {subjects.map((sub) => {
                    const v = marks.get(`${r.id}_${sub.subject}`);
                    const fail = v !== undefined && v < sub.max_marks * 0.35;
                    return <td key={sub.subject} style={fail ? { color: 'var(--red-ink)', fontWeight: 700 } : undefined}>{v ?? '—'}</td>;
                  })}
                  <td><strong>{r.complete ? r.total : '—'}</strong></td>
                  <td>{r.complete ? r.pct.toFixed(1) : '—'}</td>
                  <td>{r.complete ? grade(r.pct) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>Rank, total and grade appear once all subjects are entered for a student. Marks below 35% are shown in red.</p>
      </div>

      <form action={sendMarksheet} className="card no-print">
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="base" value={base} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>Send marks to parents on WhatsApp</strong>
            <div className="muted">Each parent receives their own child&apos;s subject marks, total, percentage, grade and rank. Only students with all subjects entered are sent. Save marks first.</div>
          </div>
          <ConfirmButton message={`Send ${exam.name} marks to parents on WhatsApp?`}>Send Marks</ConfirmButton>
        </div>
      </form>

      <form action={deleteExam} className="no-print" style={{ marginTop: 8 }}>
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="base" value={base} />
        <button type="submit" className="danger">Delete this exam</button>
      </form>
    </>
  );
}
