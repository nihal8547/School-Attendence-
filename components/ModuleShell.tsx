import { requireRole } from '@/lib/session';
import ClassPicker from './ClassPicker';
import Icon from '@/components/Icon';

export type ModProps = { role: 'admin' | 'teacher'; searchParams: { class?: string; ok?: string; err?: string } };

export async function moduleRole(role: 'admin' | 'teacher') {
  await requireRole(role);
}

export function ModuleHead({ title, intro, searchParams, classes, classId }: { title: string; intro: string; searchParams: ModProps['searchParams']; classes: { id: number; name: string }[]; classId: number }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>{intro}</p>
        </div>
      </div>
      {searchParams.ok && <div className="msg"><Icon n="check" /> {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err"><Icon n="x" /> {searchParams.err}</div>}
      {classes.length ? (
        <div className="card"><ClassPicker classes={classes} value={classId} /></div>
      ) : (
        <div className="msg err">No class has this module enabled. Ask your school admin (Class Groups) to switch it on.</div>
      )}
    </>
  );
}
