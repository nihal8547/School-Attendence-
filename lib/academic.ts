import { q } from '@/lib/db';

import { SCHEMA_SQL } from '@/lib/schema-sql';

// Creates any missing tables/columns (the whole schema is idempotent), so an already-running
// database picks up new features without re-running db-setup.
let ready: Promise<void> | null = null;
export function ensureAcademicTables() {
  if (!ready) {
    ready = q(SCHEMA_SQL).then(() => undefined).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
export const ensureSchema = ensureAcademicTables;

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

export function grade(pct: number) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 35) return 'D';
  return 'E';
}
