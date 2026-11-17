import { q } from '@/lib/db';

export async function getSchool() {
  const rows = await q<{ key: string; value: string }>(`SELECT key, value FROM att.settings WHERE key IN ('school_name','school_address')`);
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { name: m.school_name || 'School', address: m.school_address || '' };
}

export async function setSetting(key: string, value: string) {
  await q(`INSERT INTO att.settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
}

export function appBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '');
}
