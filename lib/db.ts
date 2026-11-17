import { Pool } from 'pg';

const g = globalThis as any;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Next.js does NOT read .env.example. Please create a .env.local file containing DATABASE_URL=postgres://user:password@host:port/dbname'
    );
  }
  return url;
}

function getPool(): Pool {
  const connectionString = getConnectionString();

  // Reset pool if connectionString changed or if previously uninitialized
  if (!g.__attPool || g.__attPoolUrl !== connectionString) {
    if (g.__attPool) {
      g.__attPool.end().catch(() => {});
    }
    g.__attPoolUrl = connectionString;
    g.__attPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_POOL_MAX) || 10,
      connectionTimeoutMillis: 15000,
    });
  }

  return g.__attPool;
}

export const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const p = getPool();
    const val = (p as any)[prop];
    return typeof val === 'function' ? val.bind(p) : val;
  },
});

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}


/** Run several statements atomically (all saved, or none). */
export async function tx<T>(fn: (run: <R = any>(text: string, params?: any[]) => Promise<{ rows: R[]; rowCount: number }>) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(async (text, params = []) => {
      const r = await client.query(text, params);
      return { rows: r.rows, rowCount: r.rowCount ?? 0 };
    });
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
