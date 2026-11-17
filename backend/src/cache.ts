// Small in-memory TTL cache for data that is read on every page but rarely changes
// (module switches, class lists, school names). Any write action clears it.
type Entry = { v: unknown; exp: number };
const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.v as T;
  const v = await load();
  store.set(key, { v, exp: Date.now() + ttlMs });
  if (store.size > 2000) for (const k of [...store.keys()].slice(0, 500)) store.delete(k);
  return v;
}
export function clearCache() {
  store.clear();
}
