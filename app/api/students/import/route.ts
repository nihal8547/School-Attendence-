import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const classId = String(form.get('class_id') || '');
    if (!(file instanceof File) || !file.size) return Response.json({ ok: false, error: 'Choose a file first' }, { status: 400 });
    if (file.size > 2_500_000) return Response.json({ ok: false, error: 'File is too large (max 2.5 MB)' }, { status: 400 });
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const res = await apiFetch('/v1/files/students-import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ class_id: classId, filename: file.name, data }),
    });
    const j = await res.json().catch(() => ({ ok: false, error: 'Import failed' }));
    return Response.json(j, { status: res.status });
  } catch {
    return Response.json({ ok: false, error: 'Server busy, try again' }, { status: 503 });
  }
}
