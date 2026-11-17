// All dates travel as 'YYYY-MM-DD' strings (select them with to_char) so time zones never shift them.
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtMoney(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function fmtPhone(p?: string | null) {
  if (!p) return '—';
  const m = /^91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
