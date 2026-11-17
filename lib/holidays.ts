import { q } from '@/lib/db';

export async function holidayOn(date: string): Promise<string | null> {
  const [h] = await q<{ name: string }>(`SELECT name FROM att.holidays WHERE holiday_date = $1::date`, [date]);
  return h?.name ?? null;
}
