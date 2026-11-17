import Link from 'next/link';
import { q } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { createSchool } from '@/lib/super-actions';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('superadmin');
  await ensureSchema();
  const sp = await searchParams;
  const schools = await q<{ id: number; name: string; active: boolean; teachers: string; classes: string; students: string; created: string }>(
    `SELECT s.id, s.name, s.active,
            (SELECT COUNT(*) FROM att.users u WHERE u.school_id = s.id AND u.role = 'teacher') AS teachers,
            (SELECT COUNT(*) FROM att.classes c WHERE c.school_id = s.id) AS classes,
            (SELECT COUNT(*) FROM att.students st JOIN att.classes c ON c.id = st.class_id WHERE c.school_id = s.id AND st.active) AS students,
            to_char(s.created_at, 'DD Mon YYYY') AS created
     FROM att.schools s ORDER BY s.name`
  );
  const tot = (k: 'teachers' | 'students') => schools.reduce((a, s) => a + Number(s[k]), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Schools</h1>
          <p className="muted" style={{ margin: 0 }}>Create schools, control which modules each school can use, and manage their admin logins.</p>
        </div>
      </div>
      {sp.ok && <div className="msg">✓ {sp.ok}</div>}
      {sp.err && <div className="msg err">✕ {sp.err}</div>}

      <div className="stat-grid">
        <div className="stat-box"><div className="n">{schools.length}</div><div className="l">Schools</div></div>
        <div className="stat-box"><div className="n">{tot('teachers')}</div><div className="l">Teachers</div></div>
        <div className="stat-box"><div className="n">{tot('students')}</div><div className="l">Active students</div></div>
      </div>

      <details className="add-panel" style={{ marginTop: 18 }} open={schools.length === 0}>
        <summary>＋ Add new school</summary>
        <form action={createSchool} className="row filters" style={{ marginTop: 14 }}>
          <label>School name<input name="name" required maxLength={100} placeholder="Sunrise Public School" /></label>
          <label>Address<input name="address" maxLength={200} placeholder="Town, District" /></label>
          <label>Admin name<input name="admin_name" maxLength={80} placeholder="Principal" /></label>
          <label>Admin email (login)<input name="admin_email" type="email" required /></label>
          <label>Admin password (min 8)<input name="admin_password" type="text" minLength={8} required /></label>
          <button type="submit">Create school</button>
        </form>
      </details>

      <div className="tile-grid" style={{ marginTop: 16 }}>
        {schools.map((s) => (
          <Link href={`/super/${s.id}`} key={s.id} className="tile" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="tile-top">
              <div className="avatar sq">{s.name.slice(0, 2).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="tile-title">{s.name}</div>
                <div className="tile-sub">Since {s.created}</div>
              </div>
              <span className={`badge ${s.active ? 'ok' : 'bad'}`}>{s.active ? 'Active' : 'Suspended'}</span>
            </div>
            <div className="tile-meta">
              <span>👩‍🏫 {s.teachers} teachers</span><span>🏫 {s.classes} classes</span><span>🎓 {s.students} students</span>
            </div>
          </Link>
        ))}
        {!schools.length && <div className="empty">No schools yet.</div>}
      </div>
    </>
  );
}
