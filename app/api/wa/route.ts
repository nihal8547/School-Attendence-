import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSession } from '@/lib/session';
import { callN8n } from '@/lib/n8n';

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'teacher') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: '' }));
  if (!['connect', 'status', 'logout'].includes(action)) return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });

  const r = await callN8n('attendance-wa', { action, teacher_id: s.uid });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.data?.error || `n8n responded ${r.status}` }, { status: 502 });
  return NextResponse.json(r.data);
}

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'teacher') return NextResponse.json({ ok: false }, { status: 401 });
  const [u] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [s.uid]);
  return NextResponse.json({ ok: true, wa_status: u?.wa_status ?? 'disconnected' });
}
