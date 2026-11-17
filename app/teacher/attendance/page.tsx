import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import AttendanceForm from '../AttendanceForm';
import AutoSubmitForm from './AutoSubmitForm';

export const dynamic = 'force-dynamic';

export default async function TeacherHome({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; session?: string }>;
}) {
  await requireRole('teacher');
  const sp = await searchParams;
  const d = await getData<{
    classes: { id: number; name: string }[]; waStatus: string; classId?: number; today?: string; date?: string; session?: string;
    holiday?: string | null; students?: any[]; sent?: boolean;
  }>('teacher-attendance', { class: sp.class, date: sp.date, session: sp.session });
  const { classes } = d;
  const me = { wa_status: d.waStatus };

  if (!classes.length) {
    return (
      <div className="card">
        <h1>Mark Attendance</h1>
        <div className="msg err">
          No class is assigned to you yet. Please contact the school administrator to assign your class.
        </div>
      </div>
    );
  }

  const classId = d.classId!;
  const today = d.today!;
  const date = d.date!;
  const session = d.session!;
  const holiday = d.holiday;
  const students = d.students!;
  const sent = d.sent ? { x: 1 } : undefined;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Daily Attendance</h1>
        <p className="muted" style={{ margin: 0 }}>
          Mark student attendance and trigger automatic WhatsApp notifications to parents.
        </p>
      </div>

      {me?.wa_status !== 'connected' && (
        <div className="msg err">
          ⚠️ Your WhatsApp device is not connected. Parent messages cannot be delivered.{' '}
          <a href="/teacher/whatsapp" style={{ marginLeft: 6, fontWeight: 600, color: 'inherit' }}>
            Connect WhatsApp Now →
          </a>
        </div>
      )}

      <div className="card">
        <AutoSubmitForm className="row filters">
          <label>
            Class
            <select name="class" defaultValue={classId}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input type="date" name="date" defaultValue={date} max={today} />
          </label>

          <label>
            Session
            <select name="session" defaultValue={session}>
              <option value="morning">Morning Session</option>
              <option value="afternoon">Afternoon Session</option>
            </select>
          </label>

          <button className="ghost load-btn" type="submit" style={{ minWidth: 90 }}>
            Load
          </button>
        </AutoSubmitForm>
      </div>

      {holiday && (
        <div className="msg err">🏖️ {date} is a holiday: {holiday}. Attendance cannot be marked for this date.</div>
      )}

      {sent && (
        <div className="msg">
          ℹ️ Attendance was already recorded for this session. Updating a mark will send an automated correction alert to that student&apos;s parent.
        </div>
      )}

      <AttendanceForm
        key={`${classId}-${date}-${session}`}
        classId={classId}
        date={date}
        session={session}
        students={students.map((x) => ({ id: x.id, roll: x.roll_no, name: x.name, status: x.status ?? null }))}
      />
    </>
  );
}
