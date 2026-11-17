import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { loadCards } from '@/lib/reportcard';
import PrintButton from './PrintButton';

export default async function ReportCardsPrint({ role, examId, studentId }: { role: 'admin' | 'teacher'; examId: number; studentId?: number }) {
  const s = await requireRole(role);
  await ensureSchema();
  const [own] = await q<{ teacher_id: number | null }>(`SELECT c.teacher_id FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1`, [examId]);
  if (!own || (role === 'teacher' && own.teacher_id !== s.uid)) notFound();
  const cards = await loadCards(examId, studentId);
  if (!cards.length) notFound();
  const base = role === 'admin' ? '/admin' : '/teacher';

  return (
    <>
      <div className="no-print" style={{ marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link href={`${base}/marks/${examId}`} className="muted">← Back</Link>
        <PrintButton label={`Print ${cards.length} report card${cards.length > 1 ? 's' : ''}`} />
      </div>
      {cards.map((c) => (
        <div key={c.student.id} className="card report-card" style={{ maxWidth: 640, margin: '0 auto 20px', pageBreakAfter: 'always', breakAfter: 'page' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #4f46e5', paddingBottom: 10, marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>{c.school.name}</h2>
            {c.school.address && <div className="muted">{c.school.address}</div>}
            <div style={{ fontWeight: 700, letterSpacing: 1, marginTop: 6 }}>REPORT CARD · {c.exam.name}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div><span className="muted">Student</span><br /><strong>{c.student.name}</strong></div>
            <div><span className="muted">Class</span><br /><strong>{c.exam.className}</strong></div>
            <div><span className="muted">Roll no.</span><br /><strong>{c.student.roll_no}</strong></div>
          </div>
          <table className="no-stack">
            <thead><tr><th>Subject</th><th style={{ textAlign: 'right' }}>Max</th><th style={{ textAlign: 'right' }}>Obtained</th></tr></thead>
            <tbody>
              {c.subjects.map((x) => (
                <tr key={x.subject}>
                  <td>{x.subject}</td>
                  <td style={{ textAlign: 'right' }}>{x.max}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: x.got !== null && x.got < x.max * 0.35 ? '#b91c1c' : undefined }}>{x.got ?? '—'}</td>
                </tr>
              ))}
              <tr><td><strong>Total</strong></td><td style={{ textAlign: 'right' }}><strong>{c.maxTotal}</strong></td><td style={{ textAlign: 'right' }}><strong>{c.complete ? c.total : '—'}</strong></td></tr>
            </tbody>
          </table>
          <div className="stat-grid" style={{ marginTop: 14 }}>
            <div className="stat-box"><div className="n">{c.complete ? `${c.pct.toFixed(1)}%` : '—'}</div><div className="l">Percentage</div></div>
            <div className="stat-box"><div className="n">{c.complete ? c.grade : '—'}</div><div className="l">Grade</div></div>
            <div className="stat-box"><div className="n">{c.rank ? `${c.rank}/${c.classSize}` : '—'}</div><div className="l">Rank</div></div>
            <div className="stat-box"><div className="n">{c.attendance === null ? '—' : `${c.attendance.toFixed(0)}%`}</div><div className="l">Attendance</div></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, color: '#6b7280', fontSize: 13 }}>
            <span>Class Teacher</span><span>Parent</span><span>Principal</span>
          </div>
        </div>
      ))}
    </>
  );
}
