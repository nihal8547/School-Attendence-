import { q } from '@/lib/db';

/** Name and address of one school (each school is its own tenant). */
export async function getSchool(schoolId: number) {
  const [r] = await q<{ name: string; address: string }>(`SELECT name, address FROM att.schools WHERE id = $1`, [schoolId]);
  return { name: r?.name || 'School', address: r?.address || '' };
}

export async function saveSchoolDetails(schoolId: number, name: string, address: string) {
  await q(`UPDATE att.schools SET name = $2, address = $3 WHERE id = $1`, [schoolId, name, address]);
}

export async function schoolIdOfClass(classId: number): Promise<number> {
  const [r] = await q<{ school_id: number }>(`SELECT school_id FROM att.classes WHERE id = $1`, [classId]);
  return r?.school_id ?? 1;
}

export function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
}
