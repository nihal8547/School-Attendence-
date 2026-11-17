import { assertConfig } from './config.js';
import { migrate } from './migrate.js';
import { closePool } from './db.js';
assertConfig();
await migrate();
console.log('Database is up to date.');
await closePool();
