import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { subjectGrade } from '@/lib/grade';
import { saveMarks, deleteExam, sendMarksheet } from '@/lib/academic-actions';
import { sendReportCards } from '@/lib/reportcard-actions';
import PrintButton from './PrintButton';
import ConfirmButton from './ConfirmButton';
import Icon from '@/components/Icon';

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
  await requireRole(role);
  const base = role === 'admin' ? '/admin' : '/teacher';
  const d = await getData<{
    exam: any; policy: { grading: 'marks' | 'grades'; showRank: boolean }; cardsOn: boolean;
    subjects: { subject: string; max_marks: number }[]; students: { id: number; roll_no: number; name: string }[];
    markRows: { student_id: number; subject: string; marks: string }[];
  }>('exam', { id: examId });
  const { exam, policy, cardsOn, subjects, students, markRows } = d;
  const gradesOnly = policy.grading === 'grades';
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
        <Link href={`${base}/marks?class=${exam.class_id}`} className="muted"><Icon n="arrow-left" /> All exams</Link>
        <h1 style={{ marginTop: 6 }}>{exam.name}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Class {exam.class_name}{exam.date_label ? ` · ${exam.date_label}` : ''} · {subjects.length} subjects · {maxTotal} total marks
        </p>
      </div>

      {searchParams.ok && <div className="msg no-print"><Icon n="check" /> {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err no-print"><Icon n="x" /> {searchParams.err}</div>}

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
          <table className="no-stack">
            <thead>
              <tr>
                {policy.showRank && <th>Rank</th>}<th>Roll</th><th>Student</th>
                {subjects.map((sub) => <th key={sub.subject}>{sub.subject}</th>)}
                {!gradesOnly && <><th>Total / {maxTotal}</th><th>%</th></>}<th>Grade</th>{cardsOn && <th className="no-print">Card</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  {policy.showRank && <td>{r.complete ? rankOf.get(r.id) : '—'}</td>}
                  <td>{r.roll_no}</td>
                  <td>{r.name}</td>
                  {subjects.map((sub) => {
                    const v = marks.get(`${r.id}_${sub.subject}`);
                    const fail = v !== undefined && v < sub.max_marks * 0.35;
                    return <td key={sub.subject} style={fail ? { color: 'var(--red-ink)', fontWeight: 700 } : undefined}>{gradesOnly ? subjectGrade(v ?? null, sub.max_marks) : v ?? '—'}</td>;
                  })}
                  {!gradesOnly && <><td><strong>{r.complete ? r.total : '—'}</strong></td><td>{r.complete ? r.pct.toFixed(1) : '—'}</td></>}
                  <td>{r.complete ? grade(r.pct) : '—'}</td>
                  {cardsOn && <td className="no-print">{r.complete ? <a href={`/api/report-card?exam=${examId}&student=${r.id}`} target="_blank" rel="noreferrer">PDF</a> : '—'}</td>}
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

      {cardsOn && <div className="card no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>Report cards (PDF)</strong>
            <div className="muted">Print or download a report card for each student, or send the PDF to every parent on WhatsApp.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn ghost" href={`${base}/marks/${examId}/cards`}><Icon n="printer" /> View / print all</Link>
            <form action={sendReportCards}>
              <input type="hidden" name="exam_id" value={examId} />
              <input type="hidden" name="base" value={base} />
              <ConfirmButton message={`Send report card PDFs for ${exam.name} to parents on WhatsApp?`}><Icon n="file" /> Send PDFs</ConfirmButton>
            </form>
          </div>
        </div>
      </div>}

      <form action={deleteExam} className="no-print" style={{ marginTop: 8 }}>
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="base" value={base} />
        <button type="submit" className="danger">Delete this exam</button>
      </form>
    </>
  );
}
