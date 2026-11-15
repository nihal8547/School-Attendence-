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
      max: 5,
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

