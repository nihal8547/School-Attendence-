import { config } from '../config.js';
export async function callN8n(path: string, body: object, timeoutMs = 8000) {
  const base = config.n8nBase;
  try {
    const res = await fetch(`${base}/webhook/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-secret': config.n8nSecret },
      body: JSON.stringify(body),
      
      signal: AbortSignal.timeout(timeoutMs),
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
