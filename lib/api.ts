// The web app never talks to the database. Everything goes through the API server (backend/),
// with the signed-in session token as a Bearer token.
import { cookies, headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';

const API = (process.env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function authHeaders(extra: Record<string, string> = {}) {
  const token = (await cookies()).get('session')?.value;
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  return { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(ip ? { 'x-client-ip': ip } : {}), ...extra };
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, { ...init, cache: 'no-store', headers: { ...(await authHeaders()), ...(init.headers as any) } });
}

/** Page data: GET /v1/q/<name>. Handles sign-out, redirects and 404 the way the pages used to. */
export async function getData<T = any>(name: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  let res: Response;
  try {
    res = await apiFetch(`/v1/q/${name}${qs.size ? `?${qs}` : ''}`);
  } catch {
    throw new Error('The server is busy. Please refresh in a moment.');
  }
  if (res.status === 401) redirect('/login');
  if (res.status === 403) {
    const j = await res.json().catch(() => ({}));
    redirect(j.home || '/login');
  }
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error('The server could not load this page. Please try again.');
  const j = await res.json();
  if (j.redirect) redirect(j.redirect);
  return j.data as T;
}

/** Form submit: POST /v1/actions/<name>; the API answers with the page to go to next. */
export async function runAction(name: string, formData: FormData): Promise<void> {
  const fields: Record<string, string | string[]> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== 'string' || k.startsWith('$ACTION')) continue;
    const prev = fields[k];
    fields[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  // checkboxes/multi-values that appear once must still be a list for getAll()
  let res: Response;
  try {
    res = await apiFetch(`/v1/actions/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields }) });
  } catch {
    return back('The server is busy. Please try again.');
  }
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) redirect('/login');
  if (j.redirect) redirect(j.redirect);
  return back(j.error || 'Something went wrong. Please try again.');
}

async function back(msg: string): Promise<never> {
  const ref = (await headers()).get('referer');
  let path = '/';
  try {
    if (ref) {
      const u = new URL(ref);
      u.searchParams.delete('ok');
      u.searchParams.delete('err');
      path = u.pathname + u.search;
    }
  } catch {}
  redirect(`${path}${path.includes('?') ? '&' : '?'}err=${encodeURIComponent(msg)}`);
}
