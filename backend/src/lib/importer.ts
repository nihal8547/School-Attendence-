import { tx } from './db.js';
import { normalizeIndianPhone } from './phone.js';

export const MAX_IMPORT_ROWS = 2000;
export const TEMPLATE_HEAD = ['Roll No', 'Student Name', 'Parent Name', 'Parent WhatsApp'];
export const TEMPLATE_SAMPLE = [
  [1, 'Ahmed Ali', 'Mr. Ali', '9876543210'],
  [2, 'Fatima Khan', 'Mrs. Khan', '9123456780'],
];

/** Minimal CSV parser (quotes, commas, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      out.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out;
}

export async function readUpload(filename: string, buf: Buffer): Promise<string[][]> {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let raw: unknown[][];
  if (ext === 'xlsx') {
    const { readSheet } = await import('read-excel-file/node');
    raw = (await readSheet(buf)) as unknown[][];
  } else if (ext === 'csv' || ext === 'txt') {
    raw = parseCsv(buf.toString('utf8'));
  } else {
    throw new Error('Upload a .xlsx or .csv file');
  }
  return raw.map((r) => (r || []).map((c) => (c === null || c === undefined ? '' : typeof c === 'number' && Number.isInteger(c) ? String(c) : String(c).trim())));
}

export type ImportResult = { added: number; skipped: { row: number; reason: string }[] };

/** rows: [roll_no, student_name, parent_name, phone]. All rows are inserted in one transaction. */
export async function importStudentRows(classId: number, rows: string[][]): Promise<ImportResult> {
  const data = rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (data.length && /roll|name/i.test(String(data[0][0] || '') + String(data[0][1] || ''))) data.shift();
  if (data.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows (max ${MAX_IMPORT_ROWS} per upload)`);
  const skipped: ImportResult['skipped'] = [];
  let added = 0;
  await tx(async (run) => {
    const have = await run<{ roll_no: number }>(`SELECT roll_no FROM att.students WHERE class_id = $1 AND active`, [classId]);
    const rolls = new Set(have.rows.map((r) => Number(r.roll_no)).filter((n) => n > 0));
    let n = 1;
    for (const r of data) {
      n++;
      const roll = Number(String(r[0] || '').replace(/\D/g, '')) || 0;
      const name = String(r[1] || '').trim().slice(0, 120);
      const gName = String(r[2] || '').trim().slice(0, 120) || null;
      const phone = normalizeIndianPhone(String(r[3] || '').replace(/\.0$/, ''));
      if (!name) { skipped.push({ row: n, reason: 'missing student name' }); continue; }
      if (!phone) { skipped.push({ row: n, reason: `invalid WhatsApp number for ${name}` }); continue; }
      if (roll > 0 && rolls.has(roll)) { skipped.push({ row: n, reason: `roll ${roll} already exists` }); continue; }
      const s = await run<{ id: number }>(`INSERT INTO att.students (class_id, roll_no, name) VALUES ($1,$2,$3) RETURNING id`, [classId, roll, name]);
      await run(`INSERT INTO att.guardians (student_id, name, phone) VALUES ($1,$2,$3)`, [s.rows[0].id, gName, phone]);
      if (roll > 0) rolls.add(roll);
      added++;
    }
  });
  return { added, skipped };
}

export function summarize(r: ImportResult): { msg: string; err: boolean } {
  if (!r.skipped.length) return { msg: `${r.added} students imported`, err: false };
  const first = r.skipped.slice(0, 3).map((s) => `row ${s.row}: ${s.reason}`).join('; ');
  return { msg: `${r.added} added, ${r.skipped.length} skipped (${first}${r.skipped.length > 3 ? '...' : ''})`, err: true };
}
