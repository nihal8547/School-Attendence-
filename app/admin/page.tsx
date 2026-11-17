import Link from 'next/link';
import { q } from '@/lib/db';
import { adminResetPassword } from '@/lib/account-actions';
import { requireRole } from '@/lib/session';
import { fmtPhone } from '@/lib/format';
import { createTeacher, createClass, assignTeacher } from './actions';

export const dynamic = 'force-dynamic';

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; tab?: string }> }) {
  await requireRole('admin');
  const { ok, err, tab: tabParam } = await searchParams;
  const tab = tabParam === 'classes' ? 'classes' : 'teachers';
  const teachers = await q<{ id: number; name: string; email: string; phone: string | null; wa_status: string }>(
    `SELECT id, name, email, phone, wa_status FROM att.users WHERE role='teacher' ORDER BY name`
  );
  const classes = await q<{ id: number; name: string; teacher_id: number | null; teacher_name: string | null; students: string }>(
    `SELECT c.id, c.name, c.teacher_id, u.name AS teacher_name,
            (SELECT COUNT(*) FROM att.students s WHERE s.class_id = c.id AND s.active) AS students
     FROM att.classes c LEFT JOIN att.users u ON u.id = c.teacher_id ORDER BY c.name`
  );
  const totalStudents = classes.reduce((a, c) => a + Number(c.students), 0);
  const connected = teachers.filter((t) => t.wa_status === 'connected').length;
  const unassigned = classes.filter((c) => !c.teacher_id).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Teachers &amp; Classes</h1>
          <p className="muted" style={{ margin: 0 }}>Manage faculty, class sections and class-teacher assignments.</p>
        </div>
      </div>

      {ok && <div className="msg">✓ {ok}</div>}
      {err && <div className="msg err">✕ {err}</div>}

      <nav className="tabs" aria-label="Teachers and classes">
        <Link href="/admin?tab=teachers" className={`tab ${tab === 'teachers' ? 'active' : ''}`}>👩‍🏫 Teachers <span className="count">{teachers.length}</span></Link>
        <Link href="/admin?tab=classes" className={`tab ${tab === 'classes' ? 'active' : ''}`}>🏫 Classes <span className="count">{classes.length}</span></Link>
      </nav>

      <div className="stat-grid">
        <div className="stat-box"><div className="n">{teachers.length}</div><div className="l">Teachers</div></div>
        <div className="stat-box"><div className="n">{classes.length}</div><div className="l">Classes</div></div>
        <div className="stat-box"><div className="n">{totalStudents}</div><div className="l">Active students</div></div>
        <div className="stat-box">
          <div className="n">{connected}<span className="muted" style={{ fontSize: 16 }}>/{teachers.length}</span></div>
          <div className="l">WhatsApp connected</div>
        </div>
      </div>

      {tab === 'teachers' && (
      <section className="section">
        <div className="section-head">
          <h2>Teachers <span className="count">{teachers.length}</span></h2>
        </div>

        <details className="add-panel" open={!teachers.length}>
          <summary>＋ Add new teacher</summary>
          <form action={createTeacher} className="row filters" style={{ marginTop: 14 }}>
            <label>Full name<input name="name" placeholder="John Doe" required /></label>
            <label>Email (login)<input name="email" type="email" placeholder="teacher@school.com" required /></label>
            <label>WhatsApp number<input name="phone" inputMode="tel" placeholder="98xxxxxxxx" required /></label>
            <label>Password (min 8)<input name="password" type="password" minLength={8} placeholder="••••••••" required /></label>
            <button type="submit">Add teacher</button>
          </form>
        </details>

        <div className="tile-grid">
          {teachers.map((t) => {
            const mine = classes.filter((c) => c.teacher_id === t.id);
            const on = t.wa_status === 'connected';
            return (
              <div className="tile" key={t.id}>
                <div className="tile-top">
                  <div className="avatar">{initials(t.name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tile-title">{t.name}</div>
                    <div className="tile-sub">{t.email}</div>
                  </div>
                  <span className={`badge ${on ? 'ok' : 'bad'}`}>{on ? '● WhatsApp' : '○ Offline'}</span>
                </div>
                <div className="tile-meta">
                  <span>📞 {fmtPhone(t.phone)}</span>
                </div>
                <div className="chips">
                  {mine.length ? mine.map((c) => <span className="chip" key={c.id}>Class {c.name}</span>) : <span className="muted" style={{ fontSize: 13 }}>No class assigned</span>}
                </div>
                <details className="tile-more">
                  <summary>🔑 Reset password</summary>
                  <form action={adminResetPassword} style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input type="hidden" name="user_id" value={t.id} />
                    <input name="password" type="text" minLength={8} placeholder="New password (min 8)" required style={{ flex: 1, minWidth: 0 }} />
                    <button type="submit" style={{ padding: '8px 14px' }}>Set</button>
                  </form>
                </details>
              </div>
            );
          })}
          {!teachers.length && <div className="empty">No teachers yet. Add your first teacher above.</div>}
        </div>
      </section>
      )}

      {tab === 'classes' && (
      <section className="section">
        <div className="section-head">
          <h2>Classes <span className="count">{classes.length}</span></h2>
          {unassigned > 0 && <span className="badge bad">{unassigned} without class teacher</span>}
        </div>

        <details className="add-panel" open={!classes.length}>
          <summary>＋ Create class section</summary>
          <form action={createClass} className="row filters" style={{ marginTop: 14 }}>
            <label>Class name<input name="name" placeholder="e.g. 5-A, Grade 10" required /></label>
            <label>
              Class teacher
              <select name="teacher_id" defaultValue="">
                <option value="">— Unassigned —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <button type="submit">Create class</button>
          </form>
        </details>

        <div className="tile-grid">
          {classes.map((c) => (
            <div className="tile" key={c.id}>
              <div className="tile-top">
                <div className="avatar sq">{c.name.slice(0, 3)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="tile-title">Class {c.name}</div>
                  <div className="tile-sub">{c.teacher_name ? `Teacher: ${c.teacher_name}` : 'No class teacher'}</div>
                </div>
                <Link href={`/admin/students?class=${c.id}`} className="badge ok" style={{ textDecoration: 'none' }}>{c.students} students</Link>
              </div>
              <form action={assignTeacher} className="assign">
                <input type="hidden" name="class_id" value={c.id} />
                <select name="teacher_id" defaultValue={c.teacher_id ?? ''} aria-label={`Class teacher for ${c.name}`}>
                  <option value="">— No teacher —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="ghost" type="submit">Save</button>
              </form>
            </div>
          ))}
          {!classes.length && <div className="empty">No classes yet. Create your first class above.</div>}
        </div>
      </section>
      )}
    </>
  );
}
