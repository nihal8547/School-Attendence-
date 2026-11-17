import { getData } from '@/lib/api';
import { requireRole } from '@/lib/session';
import { createGroup, createDefaultGroups, saveGroup, deleteGroup, assignClassGroup } from '@/lib/group-actions';
import ConfirmButton from '@/components/ConfirmButton';
import Icon from '@/components/Icon';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole('admin');
  const sp = await searchParams;
  const d = await getData<{
    off: string[]; groups: { id: number; name: string; grading: string; show_rank: boolean; classes: string }[]; groupOff: string[];
    classes: { id: number; name: string; group_id: number | null }[]; groupModules: { key: string; label: string; desc: string }[];
  }>('groups');
  const off = new Set(d.off);
  const groups = d.groups;
  const groupOff = new Set(d.groupOff);
  const classes = d.classes;
  const available = d.groupModules.filter((m) => !off.has(m.key));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Class Groups</h1>
          <p className="muted" style={{ margin: 0 }}>Make groups like Primary and Secondary. Each group has its own modules and grading style, and you put classes into a group.</p>
        </div>
      </div>
      {sp.ok && <div className="msg"><Icon n="check" /> {sp.ok}</div>}
      {sp.err && <div className="msg err"><Icon n="x" /> {sp.err}</div>}

      <details className="add-panel" open={!groups.length}>
        <summary><Icon n="plus" /> Add a group</summary>
        <form action={createGroup} className="row filters" style={{ marginTop: 14 }}>
          <label>Group name<input name="name" required maxLength={60} placeholder="e.g. Primary, High School" /></label>
          <label>
            Marks style
            <select name="grading" defaultValue="marks">
              <option value="marks">Marks, total and percentage</option>
              <option value="grades">Grades only (A+, A, B…)</option>
            </select>
          </label>
          <label className="check-row"><input type="checkbox" name="show_rank" defaultChecked /> Show class rank</label>
          <button type="submit">Add group</button>
        </form>
        {!groups.length && (
          <form action={createDefaultGroups} style={{ marginTop: 10 }}>
            <button type="submit" className="ghost">Quick start: add Primary, Upper Primary, Secondary</button>
          </form>
        )}
      </details>

      <div className="tile-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', marginTop: 16 }}>
        {groups.map((g) => (
          <div className="tile" key={g.id}>
            <form action={saveGroup} style={{ display: 'grid', gap: 12 }}>
              <input type="hidden" name="group_id" value={g.id} />
              <div className="tile-top">
                <div className="avatar sq">{g.name.slice(0, 2).toUpperCase()}</div>
                <input name="name" defaultValue={g.name} required maxLength={60} style={{ flex: 1, minWidth: 0, fontWeight: 700 }} />
                <span className="badge ok">{g.classes} classes</span>
              </div>
              <label>
                Marks style
                <select name="grading" defaultValue={g.grading}>
                  <option value="marks">Marks, total and percentage</option>
                  <option value="grades">Grades only (A+, A, B…)</option>
                </select>
              </label>
              <label className="check-row"><input type="checkbox" name="show_rank" defaultChecked={g.show_rank} /> Show class rank</label>
              <div>
                <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>MODULES FOR THIS GROUP</div>
                <div className="chips-check">
                  {available.map((m) => (
                    <label key={m.key} className="chip-check">
                      <input type="checkbox" name="module" value={m.key} defaultChecked={!groupOff.has(`${g.id}:${m.key}`)} />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
                {d.groupModules.length !== available.length && <p className="hint" style={{ margin: '6px 0 0' }}>Modules not shown are not enabled for your school.</p>}
              </div>
              <button type="submit">Save group</button>
            </form>
            <form action={deleteGroup}>
              <input type="hidden" name="group_id" value={g.id} />
              <ConfirmButton message={`Delete group ${g.name}? Its classes will use the school defaults.`}>Delete group</ConfirmButton>
            </form>
          </div>
        ))}
      </div>

      <section className="section">
        <div className="section-head"><h2>Put classes in groups</h2></div>
        <div className="tile-grid">
          {classes.map((c) => (
            <form action={assignClassGroup} className="tile" key={c.id}>
              <input type="hidden" name="class_id" value={c.id} />
              <div className="tile-title">Class {c.name}</div>
              <div className="assign">
                <select name="group_id" defaultValue={c.group_id ?? ''} aria-label={`Group for ${c.name}`}>
                  <option value="">— No group (all modules, marks style) —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="ghost" type="submit">Save</button>
              </div>
            </form>
          ))}
          {!classes.length && <div className="empty">Create classes first under Teachers &amp; Classes.</div>}
        </div>
      </section>
    </>
  );
}
