import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { updateSchool, setSchoolActive, setSchoolModules, addSchoolAdmin, resetAdminPassword } from '@/lib/super-actions';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function Page({ params, searchParams }: { params: Promise<{ schoolId: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('superadmin');
  const id = Number((await params).schoolId);
  const sp = await searchParams;
  const d = await getData<{
    school: { id: number; name: string; address: string; active: boolean }; off: string[]; admins: { id: number; name: string; email: string }[];
    c: { teachers: string; classes: string; students: string }; modules: { key: string; label: string; desc: string; group: boolean }[];
  }>('super-school', { id });
  const { school, admins, c, modules: MODULES } = d;
  const off = new Set(d.off);

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/super" className="muted"><Icon n="arrow-left" /> All schools</Link>
          <h1 style={{ marginTop: 6 }}>{school.name} <span className={`badge ${school.active ? 'ok' : 'bad'}`} style={{ verticalAlign: 'middle' }}>{school.active ? 'Active' : 'Suspended'}</span></h1>
          <p className="muted" style={{ margin: 0 }}>{c.teachers} teachers · {c.classes} classes · {c.students} students</p>
        </div>
      </div>
      {sp.ok && <div className="msg"><Icon n="check" /> {sp.ok}</div>}
      {sp.err && <div className="msg err"><Icon n="x" /> {sp.err}</div>}

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
          <summary><Icon n="plus" /> Add another admin</summary>
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
