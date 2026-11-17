import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getPool } from './db.js';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** Applies the numbered .sql files in /migrations once each (tracked in att.schema_migrations). Safe to run on every start. */
export async function migrate(log: (m: string) => void = console.log) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727001)');
    await client.query('CREATE SCHEMA IF NOT EXISTS att');
    await client.query(`CREATE TABLE IF NOT EXISTS att.schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const done = new Map((await client.query('SELECT name, checksum FROM att.schema_migrations')).rows.map((r) => [r.name, r.checksum]));
    const files = fs.readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const sum = crypto.createHash('sha256').update(sql).digest('hex');
      if (done.has(f)) continue;
      log(`migration ${f}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO att.schema_migrations (name, checksum) VALUES ($1,$2)', [f, sum]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
    client.release();
  }
}
