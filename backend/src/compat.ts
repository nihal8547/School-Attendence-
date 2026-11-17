// Lets the action modules (written for Next.js server actions) run unchanged in the API:
// redirect()/backTo() throw, the route turns that into JSON, and form data comes from a JSON body.
import { clearCache } from './cache.js';

export class Redirect extends Error {
  constructor(public path: string) {
    super('redirect:' + path);
  }
}
export function redirect(path: string): never {
  throw new Redirect(path);
}
export function revalidatePath(_p?: string) {
  clearCache();
}

export type Fields = Record<string, string | string[]>;
export class FormLike {
  constructor(private f: Fields) {}
  get(k: string): string | null {
    const v = this.f[k];
    if (v === undefined) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }
  getAll(k: string): string[] {
    const v = this.f[k];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  }
}
// Action files use `FormData` only as a type.
export type FormDataT = FormLike;
