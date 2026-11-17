import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams.toString();
  try {
    const res = await apiFetch(`/v1/files/reports.csv?${qs}`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'text/csv',
        ...(res.headers.get('content-disposition') ? { 'content-disposition': res.headers.get('content-disposition')! } : {}),
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response('server busy', { status: 503 });
  }
}
