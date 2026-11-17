import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await apiFetch('/v1/attendance', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    return new NextResponse(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'The server is busy. Please try again.' }, { status: 503 });
  }
}
