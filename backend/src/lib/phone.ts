// Indian mobile numbers only. Stored as 91XXXXXXXXXX (no +, no spaces).
export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return /^91[6-9]\d{9}$/.test(d) ? d : null;
}
