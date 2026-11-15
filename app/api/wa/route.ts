import { NextResponse } from 'next/server';
import { q } from '@/lib/db';
import { getSession } from '@/lib/session';
import { callN8n } from '@/lib/n8n';
import { saveWaStatus } from '@/lib/wa';

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== 'teacher') return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: '' }));
  if (!['connect', 'status', 'logout'].includes(action)) return NextResponse.json({ ok: false, error: 'bad action' }, { status: 400 });

  const secret = process.env.N8N_WEBHOOK_SECRET || '';
  if (!secret || secret.startsWith('same-value')) {
    return NextResponse.json({ ok: false, error: 'Server setup: N8N_WEBHOOK_SECRET is missing or still the placeholder in .env. Copy the real value, then restart the app.' }, { status: 500 });
  }
  const r = await callN8n('attendance-wa', { action, teacher_id: s.uid });
  if (r.status === 401) {
    return NextResponse.json({ ok: false, error: 'Server setup: N8N_WEBHOOK_SECRET does not match the secret in the n8n workflow. Fix .env and restart the app.' }, { status: 502 });
  }
  if (r.status === 0) {
    return NextResponse.json({ ok: false, error: `Cannot reach n8n (${process.env.N8N_BASE_URL || 'N8N_BASE_URL not set'}). Check the URL and network.` }, { status: 502 });
  }
  if (r.status === 404) {
    return NextResponse.json({ ok: false, error: 'n8n webhook not found. Make sure the workflow "Attendance · WhatsApp Connect" is published.' }, { status: 502 });
  }
  if (!r.ok) return NextResponse.json({ ok: false, error: r.data?.error || `n8n responded ${r.status}` }, { status: 502 });
  if (action === 'status' || action === 'logout') {
    const st = r.data?.wa_status === 'connected' ? 'connected' : 'disconnected';
    await saveWaStatus(s.uid, st);
  }
  return NextResponse.json(r.data);
}

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== 'teacher') return NextResponse.json({ ok: false }, { status: 401 });
  const [u] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [s.uid]);
  return NextResponse.json({ ok: true, wa_status: u?.wa_status ?? 'disconnected' });
}
