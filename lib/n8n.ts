export async function callN8n(path: string, body: object) {
  const base = process.env.N8N_BASE_URL || 'https://n8n.webbea.qa';
  try {
    const res = await fetch(`${base}/webhook/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-secret': process.env.N8N_WEBHOOK_SECRET || '' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, data: { error: String(e?.message || e) } };
  }
}

export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
