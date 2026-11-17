import { apiFetch } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Public URL used in WhatsApp (signed link) and by signed-in users. The API builds the PDF. */
export async function GET(req: Request) {
  const qs = new URL(req.url).searchParams.toString();
  try {
    const res = await apiFetch(`/v1/files/report-card?${qs}`);
    return new Response(res.body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/octet-stream',
        ...(res.headers.get('content-disposition') ? { 'content-disposition': res.headers.get('content-disposition')! } : {}),
        'cache-control': 'private, no-store',
      },
    });
  } catch {
    return new Response('server busy', { status: 503 });
  }
}
