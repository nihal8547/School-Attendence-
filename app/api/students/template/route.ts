import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const fmt = new URL(req.url).searchParams.get('fmt') === 'xlsx' ? 'xlsx' : 'csv';
  try {
    const res = await apiFetch(`/v1/files/students-template.${fmt}`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/octet-stream',
        ...(res.headers.get('content-disposition') ? { 'content-disposition': res.headers.get('content-disposition')! } : {}),
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response('server busy', { status: 503 });
  }
}
