import pg from 'pg';
import { config } from './config.js';

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: config.dbPoolMax,
      connectionTimeoutMillis: 15000,
      statement_timeout: 30000,
    });
    pool.on('error', (e) => console.error('pg pool error', e.message));
  }
  return pool;
}
export async function closePool() {
  await pool?.end();
  pool = null;
}
