import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureAcademicTables, DAYS, PERIODS } from '@/lib/academic';
import { saveTimetable } from '@/lib/academic-actions';
import ClassPicker from './ClassPicker';
import PrintButton from './PrintButton';

export default async function TimetableView({
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
        <h1>Timetable</h1>
        <div className="msg err">No class available yet. {role === 'teacher' ? 'Please contact the school administrator to assign your class.' : 'Create a class first.'}</div>
      </div>
    );
  }

  const classId = classes.find((c) => String(c.id) === searchParams.class)?.id ?? classes[0].id;
  const className = classes.find((c) => c.id === classId)!.name;
  const rows = await q<{ day_of_week: number; period: number; subject: string }>(
    `SELECT day_of_week, period, subject FROM att.timetable WHERE class_id = $1`,
    [classId]
  );
  const cell = new Map(rows.map((r) => [`${r.day_of_week}_${r.period}`, r.subject]));

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Timetable</h1>
        <p className="muted" style={{ margin: 0 }}>Weekly class timetable. Leave a period empty if there is no class.</p>
      </div>

      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}

      <div className="card no-print">
        <ClassPicker classes={classes} value={classId} />
      </div>

      <form action={saveTimetable} className="card">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="base" value={base} />
        <div className="print-title">Class {className} · Weekly Timetable</div>
        <div className="table-wrapper">
          <table className="tt-grid">
            <thead>
              <tr>
                <th>Day</th>
                {PERIODS.map((p) => (
                  <th key={p}>P{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, i) => (
                <tr key={d}>
                  <td><strong>{d}</strong></td>
                  {PERIODS.map((p) => (
                    <td key={p}>
                      <input name={`c_${i + 1}_${p}`} defaultValue={cell.get(`${i + 1}_${p}`) ?? ''} maxLength={40} placeholder="—" aria-label={`${d} period ${p}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="no-print" style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <PrintButton label="Print timetable" />
          <button type="submit" style={{ minWidth: 160 }}>Save Timetable</button>
        </div>
      </form>
    </>
  );
}
