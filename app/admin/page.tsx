import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { createTeacher, createClass, assignTeacher } from './actions';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireRole('admin');
  const { ok, err } = await searchParams;
  const teachers = await q(
    `SELECT id, name, email, phone, wa_status FROM att.users WHERE role='teacher' ORDER BY name`
  );
  const classes = await q(
    `SELECT c.id, c.name, c.teacher_id, u.name AS teacher_name,
            (SELECT COUNT(*) FROM att.students s WHERE s.class_id = c.id AND s.active) AS students
     FROM att.classes c LEFT JOIN att.users u ON u.id = c.teacher_id ORDER BY c.name`
  );

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1>Teachers &amp; Classes</h1>
        <p className="muted" style={{ margin: 0 }}>
          Manage your faculty members, define class sections, and assign class teachers.
        </p>
      </div>

      {ok && <div className="msg">✓ {ok}</div>}
      {err && <div className="msg err">✕ {err}</div>}

      {/* Add Teacher Card */}
      <div className="card">
        <h2>Add New Teacher</h2>
        <form action={createTeacher} className="row">
          <label>
            Full Name
            <input name="name" placeholder="John Doe" required />
          </label>
          <label>
            Email (Login)
            <input name="email" type="email" placeholder="teacher@school.com" required />
          </label>
          <label>
            WhatsApp Phone Number
            <input name="phone" placeholder="98xxxxxxxx" required />
          </label>
          <label>
            Password (min 8 chars)
            <input name="password" type="password" minLength={8} placeholder="••••••••" required />
          </label>
          <button type="submit">Add Teacher</button>
        </form>
      </div>

      {/* Teachers List */}
      <div className="card">
        <h2>
          <span>Registered Teachers</span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            {teachers.length} total
          </span>
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>WhatsApp Status</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td>{t.email}</td>
                  <td>{t.phone}</td>
                  <td>
                    <span className={`badge ${t.wa_status === 'connected' ? 'ok' : 'bad'}`}>
                      {t.wa_status === 'connected' ? '● Connected' : '○ Disconnected'}
                    </span>
                  </td>
                </tr>
              ))}
              {!teachers.length && (
                <tr>
                  <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    No teachers registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Class Card */}
      <div className="card">
        <h2>Create Class Section</h2>
        <form action={createClass} className="row">
          <label>
            Class Name
            <input name="name" placeholder="e.g. 5-A, Grade 10" required />
          </label>
          <label>
            Assign Class Teacher
            <select name="teacher_id" defaultValue="">
              <option value="">— Unassigned —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Class</button>
        </form>
      </div>

      {/* Classes List */}
      <div className="card">
        <h2>
          <span>Classes Overview</span>
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            {classes.length} classes
          </span>
        </h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Active Students</th>
                <th>Assigned Teacher</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>
                    <span className="badge ok">{c.students} students</span>
                  </td>
                  <td>
                    <form action={assignTeacher} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="hidden" name="class_id" value={c.id} />
                      <select name="teacher_id" defaultValue={c.teacher_id ?? ''} style={{ maxWidth: 200 }}>
                        <option value="">— None —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <button className="ghost" type="submit" style={{ padding: '7px 12px', fontSize: 13 }}>
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {!classes.length && (
                <tr>
                  <td colSpan={3} className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                    No classes created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
