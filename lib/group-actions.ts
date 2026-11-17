'use server';
import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/academic';
import { mustAdmin, backTo, schoolOwns } from '@/lib/access';
import { GROUP_MODULES } from '@/lib/modules';

const PATH = '/admin/groups';

async function ownGroup(sid: number, id: number) {
  return (await q(`SELECT 1 FROM att.class_groups WHERE id = $1 AND school_id = $2`, [id, sid])).length > 0;
}

export async function createGroup(formData: FormData) {
  await ensureSchema();
  const s = await mustAdmin();
  const name = String(formData.get('name') || '').trim().slice(0, 60);
  const grading = formData.get('grading') === 'grades' ? 'grades' : 'marks';
  if (!name) backTo(PATH, 'Group name is required', true);
  try {
    await q(`INSERT INTO att.class_groups (school_id, name, grading, show_rank) VALUES ($1,$2,$3,$4)`, [s.sid, name, grading, formData.get('show_rank') === 'on']);
  } catch {
    backTo(PATH, 'A group with that name already exists', true);
  }
  revalidatePath(PATH);
  backTo(PATH, `Group "${name}" created`);
}

export async function createDefaultGroups() {
  await ensureSchema();
  const s = await mustAdmin();
  await q(
    `INSERT INTO att.class_groups (school_id, name, grading, show_rank) VALUES
       ($1, 'Primary', 'grades', FALSE), ($1, 'Upper Primary', 'marks', TRUE), ($1, 'Secondary', 'marks', TRUE)
     ON CONFLICT (school_id, name) DO NOTHING`,
    [s.sid]
  );
  revalidatePath(PATH);
  backTo(PATH, 'Default groups added: Primary (grades, no rank), Upper Primary and Secondary (marks and rank)');
}

export async function saveGroup(formData: FormData) {
  await ensureSchema();
  const s = await mustAdmin();
  const id = Number(formData.get('group_id'));
  if (!(await ownGroup(s.sid, id))) backTo(PATH, 'Group not found', true);
  const name = String(formData.get('name') || '').trim().slice(0, 60);
  if (!name) backTo(PATH, 'Group name is required', true);
  const on = new Set(formData.getAll('module').map(String));
  try {
    await q(`UPDATE att.class_groups SET name = $2, grading = $3, show_rank = $4 WHERE id = $1`, [
      id, name, formData.get('grading') === 'grades' ? 'grades' : 'marks', formData.get('show_rank') === 'on',
    ]);
  } catch {
    backTo(PATH, 'A group with that name already exists', true);
  }
  for (const m of GROUP_MODULES) {
    await q(
      `INSERT INTO att.class_group_modules (group_id, module_key, enabled) VALUES ($1,$2,$3)
       ON CONFLICT (group_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled`,
      [id, m.key, on.has(m.key)]
    );
  }
  revalidatePath(PATH);
  backTo(PATH, `Group "${name}" saved`);
}

export async function deleteGroup(formData: FormData) {
  await ensureSchema();
  const s = await mustAdmin();
  const id = Number(formData.get('group_id'));
  if (!(await ownGroup(s.sid, id))) backTo(PATH, 'Group not found', true);
  await q(`DELETE FROM att.class_groups WHERE id = $1`, [id]);
  revalidatePath(PATH);
  backTo(PATH, 'Group deleted. Its classes now use the school defaults.');
}

export async function assignClassGroup(formData: FormData) {
  await ensureSchema();
  const s = await mustAdmin();
  const classId = Number(formData.get('class_id'));
  const groupId = Number(formData.get('group_id')) || null;
  if (!(await schoolOwns(s, 'class', classId)) || (groupId && !(await ownGroup(s.sid, groupId)))) backTo(PATH, 'Not found', true);
  await q(`UPDATE att.classes SET group_id = $2 WHERE id = $1`, [classId, groupId]);
  revalidatePath(PATH);
  backTo(PATH, 'Class group updated');
}
