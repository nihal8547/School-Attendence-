import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { MODULES } from '@/lib/modules';
import { updateSchool, setSchoolActive, setSchoolModules, addSchoolAdmin, resetAdminPassword } from '@/lib/super-actions';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('superadmin');
  await ensureSchema();
  const id = Number((await params).schoolId);
  const sp = await searchParams;
  const [school] = await q<{ id: number; name: string; address: string; active: boolean }>(`SELECT id, name, address, active FROM att.schools WHERE id = $1`, [id]);
  if (!school) notFound();
  const off = new Set((await q<{ module_key: string }>(`SELECT module_key FROM att.school_modules WHERE school_id = $1 AND NOT enabled`, [id])).map((r) => r.module_key));
  const admins = await q<{ id: number; name: string; email: string }>(`SELECT id, name, email FROM att.users WHERE school_id = $1 AND role = 'admin' ORDER BY id`, [id]);
  const [c] = await q<{ teachers: string; classes: string; students: string }>(
    `SELECT (SELECT COUNT(*) FROM att.users WHERE school_id = $1 AND role = 'teacher') AS teachers,
            (SELECT COUNT(*) FROM att.classes WHERE school_id = $1) AS classes,
            (SELECT COUNT(*) FROM att.students st JOIN att.classes c ON c.id = st.class_id WHERE c.school_id = $1 AND st.active) AS students`,
    [id]
  );

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/super" className="muted">← All schools</Link>
          <h1 style={{ marginTop: 6 }}>{school.name} <span className={`badge ${school.active ? 'ok' : 'bad'}`} style={{ verticalAlign: 'middle' }}>{school.active ? 'Active' : 'Suspended'}</span></h1>
          <p className="muted" style={{ margin: 0 }}>{c.teachers} teachers · {c.classes} classes · {c.students} students</p>
        </div>
      </div>
      {sp.ok && <div className="msg">✓ {sp.ok}</div>}
      {sp.err && <div className="msg err">✕ {sp.err}</div>}

      <form action={setSchoolModules} className="card">
        <input type="hidden" name="school_id" value={id} />
        <h2>Modules for this school</h2>
        <p className="hint" style={{ marginTop: -6 }}>Tick what this school can use. The school admin can then switch the class-level ones on or off per class group (Primary, Secondary…). Attendance is always on.</p>
        <div className="module-grid">
          {MODULES.map((m) => (
            <label key={m.key} className="module-opt">
              <input type="checkbox" name="module" value={m.key} defaultChecked={!off.has(m.key)} />
              <span><strong>{m.label}</strong><small>{m.desc}</small></span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}><button type="submit">Save modules</button></div>
      </form>

      <form action={updateSchool} className="card">
        <input type="hidden" name="school_id" value={id} />
        <h2>School details</h2>
        <div className="row filters">
          <label>Name<input name="name" defaultValue={school.name} required maxLength={100} /></label>
          <label>Address<input name="address" defaultValue={school.address} maxLength={200} /></label>
          <button type="submit">Save</button>
        </div>
      </form>

      <div className="card">
        <h2>School admins</h2>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Reset password</th></tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td><strong>{a.name}</strong></td>
                  <td>{a.email}</td>
                  <td>
                    <form action={resetAdminPassword} style={{ display: 'flex', gap: 8 }}>
                      <input type="hidden" name="school_id" value={id} />
                      <input type="hidden" name="user_id" value={a.id} />
                      <input name="password" type="text" minLength={8} placeholder="New password" required style={{ minWidth: 0 }} />
                      <button type="submit" className="ghost" style={{ padding: '8px 14px' }}>Set</button>
                    </form>
                  </td>
                </tr>
              ))}
              {!admins.length && <tr><td colSpan={3} className="muted" style={{ textAlign: 'center' }}>No admin yet. Add one below.</td></tr>}
            </tbody>
          </table>
        </div>
        <details className="tile-more" style={{ marginTop: 12 }}>
          <summary>＋ Add another admin</summary>
          <form action={addSchoolAdmin} className="row filters" style={{ marginTop: 12 }}>
            <input type="hidden" name="school_id" value={id} />
            <label>Name<input name="name" maxLength={80} /></label>
            <label>Email<input name="email" type="email" required /></label>
            <label>Password (min 8)<input name="password" type="text" minLength={8} required /></label>
            <button type="submit">Add admin</button>
          </form>
        </details>
      </div>

      <form action={setSchoolActive} className="card">
        <input type="hidden" name="school_id" value={id} />
        <input type="hidden" name="active" value={school.active ? '0' : '1'} />
        <h2>{school.active ? 'Suspend school' : 'Activate school'}</h2>
        <p className="hint" style={{ marginTop: -6 }}>{school.active ? 'Suspended schools cannot sign in. Nothing is deleted and WhatsApp sending of already-queued messages continues.' : 'Let this school sign in again.'}</p>
        <button type="submit" className={school.active ? 'danger' : ''}>{school.active ? 'Suspend' : 'Activate'}</button>
      </form>
    </>
  );
}
