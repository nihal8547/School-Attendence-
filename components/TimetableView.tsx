import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { DAYS, PERIODS } from '@/lib/grade';
import { saveTimetable, sendTimetable } from '@/lib/academic-actions';
import ClassPicker from './ClassPicker';
import PrintButton from './PrintButton';
import ConfirmButton from './ConfirmButton';
import Icon from '@/components/Icon';

export default async function TimetableView({
  role,
  searchParams,
}: {
  role: 'admin' | 'teacher';
  searchParams: { class?: string; ok?: string; err?: string };
}) {
  await requireRole(role);
  const base = role === 'admin' ? '/admin' : '/teacher';
  const { classes, classId, rows } = await getData<{ classes: { id: number; name: string }[]; classId: number; rows: { day_of_week: number; period: number; subject: string }[] }>('timetable', { class: searchParams.class });

  if (!classes.length) {
    return (
      <div className="card">
        <h1>Timetable</h1>
        <div className="msg err">No class available yet. {role === 'teacher' ? 'Please contact the school administrator to assign your class.' : 'Create a class first.'}</div>
      </div>
    );
  }

  const className = classes.find((c) => c.id === classId)!.name;
  const cell = new Map(rows.map((r) => [`${r.day_of_week}_${r.period}`, r.subject]));

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Timetable</h1>
        <p className="muted" style={{ margin: 0 }}>Weekly class timetable. Leave a period empty if there is no class.</p>
      </div>

      {searchParams.ok && <div className="msg"><Icon n="check" /> {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err"><Icon n="x" /> {searchParams.err}</div>}

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

      <form action={sendTimetable} className="card no-print">
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="base" value={base} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <strong>Send to parents on WhatsApp</strong>
            <div className="muted">Sends the saved timetable to every parent of Class {className} from the class teacher&apos;s WhatsApp. Save your changes first.</div>
          </div>
          <ConfirmButton message={`Send the Class ${className} timetable to all parents on WhatsApp?`}>Send Timetable</ConfirmButton>
        </div>
      </form>
    </>
  );
}
