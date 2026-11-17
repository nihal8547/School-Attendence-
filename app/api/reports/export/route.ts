import { getSession } from '@/lib/session';
import { ensureSchema } from '@/lib/academic';
import { csvCell, fmtDate } from '@/lib/format';
import { parseParams, scopeClassIds, studentSummary, absenteeList, classComparison, pct } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response('unauthorized', { status: 401 });
  await ensureSchema();
  const u = new URL(req.url).searchParams;
  const p = parseParams({ type: u.get('type') || '', class: u.get('class') || '', from: u.get('from') || '', to: u.get('to') || '' }, s.role);
  const ids = await scopeClassIds(s, p.classId);

  let head: string[] = [];
  let rows: unknown[][] = [];
  if (p.type === 'students') {
    head = ['Class', 'Roll', 'Student', 'Present sessions', 'Absent sessions', 'Marked sessions', 'Attendance %'];
    rows = (await studentSummary(ids, p.from, p.to)).map((r) => [r.class_name, r.roll_no, r.name, r.present, r.absent, r.total, pct(r.present, r.total)?.toFixed(1) ?? '']);
  } else if (p.type === 'absentees') {
    head = ['Date', 'Session', 'Class', 'Roll', 'Student', 'Parent WhatsApp'];
    rows = (await absenteeList(ids, p.from, p.to)).map((r) => [fmtDate(r.d), r.session, r.class_name, r.roll_no, r.name, r.phone ?? '']);
  } else {
    head = ['Class', 'Class teacher', 'Students', 'Present sessions', 'Absent sessions', 'Marked sessions', 'Attendance %'];
    rows = (await classComparison(ids, p.from, p.to)).map((r) => [r.class_name, r.teacher ?? '', r.students, r.present, r.absent, r.total, pct(r.present, r.total)?.toFixed(1) ?? '']);
  }

  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="attendance-${p.type}-${p.from}-to-${p.to}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
