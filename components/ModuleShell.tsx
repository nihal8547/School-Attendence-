import { requireRole } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { requireModule, classesForModule, type ModuleKey } from '@/lib/modules';
import ClassPicker from './ClassPicker';

export type ModProps = { role: 'admin' | 'teacher'; searchParams: { class?: string; ok?: string; err?: string } };

/** Shared start of the module pages: sign-in, module switch, class list and the chosen class. */
export async function moduleContext(role: 'admin' | 'teacher', key: ModuleKey, searchParams: ModProps['searchParams']) {
  const s = await requireRole(role);
  await ensureSchema();
  await requireModule(s, key, role === 'admin' ? '/admin' : '/teacher');
  const classes = await classesForModule(s, key);
  const classId = classes.find((c) => String(c.id) === searchParams.class)?.id ?? classes[0]?.id ?? 0;
  return { s, classes, classId };
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
      {searchParams.ok && <div className="msg">✓ {searchParams.ok}</div>}
      {searchParams.err && <div className="msg err">✕ {searchParams.err}</div>}
      {classes.length ? (
        <div className="card"><ClassPicker classes={classes} value={classId} /></div>
      ) : (
        <div className="msg err">No class has this module enabled. {`Ask your school admin (Class Groups) to switch it on.`}</div>
      )}
    </>
  );
}
