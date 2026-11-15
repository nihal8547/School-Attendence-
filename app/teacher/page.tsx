import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { todayIST } from '@/lib/n8n';
import AttendanceForm from './AttendanceForm';

export const dynamic = 'force-dynamic';

export default async function TeacherHome({ searchParams }: { searchParams: Promise<{ class?: string; date?: string; session?: string }> }) {
  const s = await requireRole('teacher');
  const sp = await searchParams;
  const classes = await q(`SELECT id, name FROM att.classes WHERE teacher_id = $1 ORDER BY name`, [s.uid]);
  const [me] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [s.uid]);
  if (!classes.length) return <div className="msg err">No class is assigned to you yet. Ask the admin.</div>;

  const classId = classes.find((c) => String(c.id) === sp.class)?.id ?? classes[0].id;
  const today = todayIST();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date || '') ? sp.date! : today;
  const hourIST = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
  const session = sp.session === 'afternoon' || sp.session === 'morning' ? sp.session : hourIST < 12 ? 'morning' : 'afternoon';

  const students = await q(
    `SELECT s.id, s.roll_no, s.name, a.status
     FROM att.students s
     LEFT JOIN att.attendance a ON a.student_id = s.id AND a.att_date = $2::date AND a.session = $3
     WHERE s.class_id = $1 AND s.active ORDER BY s.roll_no, s.name`,
    [classId, date, session]
  );
  const [sent] = await q(`SELECT 1 AS x FROM att.session_marks WHERE class_id=$1 AND att_date=$2::date AND session=$3`, [classId, date, session]);

  return (
    <>
      <h1>Mark attendance</h1>
      {me?.wa_status !== 'connected' && (
        <div className="msg err">
          Your WhatsApp is not connected, so parent messages will fail. <a href="/teacher/whatsapp">Connect now</a>
        </div>
      )}
      <form className="card row" method="get">
        <label>Class
          <select name="class" defaultValue={classId}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label>Date<input type="date" name="date" defaultValue={date} max={today} /></label>
        <label>Session
          <select name="session" defaultValue={session}><option value="morning">Morning</option><option value="afternoon">Afternoon</option></select>
        </label>
        <button className="ghost" type="submit">Open</button>
      </form>
      {sent && <div className="msg">Already submitted for this session. Changing a mark will send a correction to that parent.</div>}
      <AttendanceForm
        key={`${classId}-${date}-${session}`}
        classId={classId}
        date={date}
        session={session}
        students={students.map((x) => ({ id: x.id, roll: x.roll_no, name: x.name, status: x.status ?? 'P' }))}
      />
    </>
  );
}
