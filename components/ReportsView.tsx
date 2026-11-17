import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { classesFor } from '@/lib/access';
import { fmtDate, fmtPhone } from '@/lib/format';
import { parseParams, scopeClassIds, studentSummary, absenteeList, classComparison, workingDays, pct } from '@/lib/reports';
import AutoSubmitForm from '@/app/teacher/attendance/AutoSubmitForm';
import PrintButton from './PrintButton';

function Bar({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  const cls = value < 75 ? 'low' : value < 90 ? 'mid' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className={`pct-bar ${cls}`} style={{ flex: 1 }}><span style={{ width: `${Math.min(100, value)}%` }} /></div>
      <strong style={{ minWidth: 44, textAlign: 'right', color: value < 75 ? 'var(--red-ink)' : undefined }}>{value.toFixed(1)}%</strong>
    </div>
  );
}

export default async function ReportsView({
  role,
  searchParams,
}: {
  role: 'admin' | 'teacher';
  searchParams: { type?: string; class?: string; from?: string; to?: string };
}) {
  const s = await requireRole(role);
  await ensureSchema();
  const classes = await classesFor(s);
  const p = parseParams(searchParams, role);
  const ids = await scopeClassIds(s, p.classId);
  const qs = new URLSearchParams({ type: p.type, class: p.classId ? String(p.classId) : '', from: p.from, to: p.to }).toString();

  if (!classes.length) {
    return (
      <div className="card">
        <h1>Reports</h1>
        <div className="msg err">No class available yet.</div>
      </div>
    );
  }

  const days = await workingDays(ids, p.from, p.to);
  const stu = p.type === 'students' ? await studentSummary(ids, p.from, p.to) : [];
  const abs = p.type === 'absentees' ? await absenteeList(ids, p.from, p.to) : [];
  const cls = p.type === 'classes' ? await classComparison(ids, p.from, p.to) : [];
  const sumP = stu.reduce((a, r) => a + Number(r.present), 0);
  const sumT = stu.reduce((a, r) => a + Number(r.total), 0);
  const avg = pct(sumP, sumT);
  const lowCount = stu.filter((r) => { const v = pct(r.present, r.total); return v !== null && v < 75; }).length;

  return (
    <>
      <div style={{ marginBottom: 20 }} className="no-print">
        <h1>Reports</h1>
        <p className="muted" style={{ margin: 0 }}>Attendance summaries for any date range. Download as Excel-compatible CSV or print.</p>
      </div>

      <div className="card no-print">
        <AutoSubmitForm className="row filters">
          <label>
            Report
            <select name="type" defaultValue={p.type}>
              <option value="students">Student-wise attendance %</option>
              <option value="absentees">Absentee list</option>
              {role === 'admin' && <option value="classes">Class-wise comparison</option>}
            </select>
          </label>
          <label>
            Class
            <select name="class" defaultValue={p.classId ?? ''}>
              <option value="">{role === 'admin' ? 'All classes' : 'All my classes'}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" name="from" defaultValue={p.from} />
          </label>
          <label>
            To
            <input type="date" name="to" defaultValue={p.to} />
          </label>
        </AutoSubmitForm>
      </div>

      <div className="stat-grid">
        <div className="stat-box"><div className="n">{days}</div><div className="l">Days marked</div></div>
        {p.type === 'students' && (
          <>
            <div className="stat-box"><div className="n">{stu.length}</div><div className="l">Students</div></div>
            <div className="stat-box"><div className="n">{avg === null ? '—' : `${avg.toFixed(1)}%`}</div><div className="l">Average attendance</div></div>
            <div className="stat-box"><div className="n" style={lowCount ? { color: 'var(--red-ink)' } : undefined}>{lowCount}</div><div className="l">Below 75%</div></div>
          </>
        )}
        {p.type === 'absentees' && <div className="stat-box"><div className="n">{abs.length}</div><div className="l">Absent entries</div></div>}
        {p.type === 'classes' && <div className="stat-box"><div className="n">{cls.length}</div><div className="l">Classes</div></div>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{fmtDate(p.from)} – {fmtDate(p.to)}</h2>
          <div className="no-print" style={{ display: 'flex', gap: 8 }}>
            <a className="btn ghost" href={`/api/reports/export?${qs}`}>⬇ Download CSV</a>
            <PrintButton />
          </div>
        </div>

        {p.type === 'students' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Class</th><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th style={{ minWidth: 170 }}>Attendance</th></tr>
              </thead>
              <tbody>
                {stu.map((r, i) => (
                  <tr key={i}>
                    <td>{r.class_name}</td><td>{r.roll_no}</td><td><strong>{r.name}</strong></td>
                    <td>{r.present}</td><td>{r.absent}</td>
                    <td><Bar value={pct(r.present, r.total)} /></td>
                  </tr>
                ))}
                {!stu.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center' }}>No students.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {p.type === 'absentees' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Session</th><th>Class</th><th>Roll</th><th>Student</th><th>Parent WhatsApp</th></tr>
              </thead>
              <tbody>
                {abs.map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDate(r.d)}</td><td style={{ textTransform: 'capitalize' }}>{r.session}</td><td>{r.class_name}</td>
                    <td>{r.roll_no}</td><td><strong>{r.name}</strong></td><td>{fmtPhone(r.phone)}</td>
                  </tr>
                ))}
                {!abs.length && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center' }}>No absences in this period 🎉</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {p.type === 'classes' && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Class</th><th>Class teacher</th><th>Students</th><th>Present</th><th>Absent</th><th style={{ minWidth: 170 }}>Attendance</th></tr>
              </thead>
              <tbody>
                {cls.map((r, i) => (
                  <tr key={i}>
                    <td><strong>{r.class_name}</strong></td><td>{r.teacher ?? '—'}</td><td>{r.students}</td>
                    <td>{r.present}</td><td>{r.absent}</td><td><Bar value={pct(r.present, r.total)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint no-print">Attendance % counts sessions (morning and afternoon each count once). Under 75% is shown in red.</p>
      </div>
    </>
  );
}
