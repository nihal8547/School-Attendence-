import { q } from '@/lib/db';

export async function holidayOn(schoolId: number, date: string): Promise<string | null> {
  const [h] = await q<{ name: string }>(`SELECT name FROM att.holidays WHERE school_id = $1 AND holiday_date = $2::date`, [schoolId, date]);
  return h?.name ?? null;
}
