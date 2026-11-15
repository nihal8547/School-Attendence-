import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { createTeacher, createClass, assignTeacher } from './actions';

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('admin');
  const { ok, err } = await searchParams;
  const teachers = await q(`SELECT id, name, email, phone, wa_status FROM att.users WHERE role='teacher' ORDER BY name`);
  const classes = await q(
    `SELECT c.id, c.name, c.teacher_id, u.name AS teacher_name,
            (SELECT COUNT(*) FROM att.students s WHERE s.class_id = c.id AND s.active) AS students
     FROM att.classes c LEFT JOIN att.users u ON u.id = c.teacher_id ORDER BY c.name`
  );
  return (
    <>
      <h1>Teachers &amp; Classes</h1>
      {ok && <div className="msg">{ok}</div>}
      {err && <div className="msg err">{err}</div>}

      <div className="card">
        <h2>Add teacher</h2>
        <form action={createTeacher} className="row">
          <label>Name<input name="name" required /></label>
          <label>Email (login)<input name="email" type="email" required /></label>
          <label>WhatsApp number<input name="phone" placeholder="98xxxxxxxx" required /></label>
          <label>Password<input name="password" type="password" minLength={8} required /></label>
          <button type="submit">Add teacher</button>
        </form>
      </div>

      <div className="card">
        <h2>Teachers</h2>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>WhatsApp</th></tr></thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td><td>{t.email}</td><td>{t.phone}</td>
                <td><span className={`badge ${t.wa_status === 'connected' ? 'ok' : 'bad'}`}>{t.wa_status}</span></td>
              </tr>
            ))}
            {!teachers.length && <tr><td colSpan={4} className="muted">No teachers yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Add class</h2>
        <form action={createClass} className="row">
          <label>Class name<input name="name" placeholder="5-A" required /></label>
          <label>Class teacher
            <select name="teacher_id" defaultValue="">
              <option value="">— none —</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <button type="submit">Add class</button>
        </form>
      </div>

      <div className="card">
        <h2>Classes</h2>
        <table>
          <thead><tr><th>Class</th><th>Students</th><th>Class teacher</th></tr></thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.students}</td>
                <td>
                  <form action={assignTeacher} className="row">
                    <input type="hidden" name="class_id" value={c.id} />
                    <select name="teacher_id" defaultValue={c.teacher_id ?? ''}>
                      <option value="">— none —</option>
                      {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <button className="ghost" type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {!classes.length && <tr><td colSpan={3} className="muted">No classes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
