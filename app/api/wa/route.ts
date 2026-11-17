import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';

async function pass(path: string, init: RequestInit) {
  try {
    const res = await apiFetch(path, init);
    return new NextResponse(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'The server is busy. Please try again.' }, { status: 503 });
  }
}
export const POST = async (req: Request) => pass('/v1/wa', { method: 'POST', headers: { 'content-type': 'application/json' }, body: await req.text() });
export const GET = async () => pass('/v1/wa', { method: 'GET' });
