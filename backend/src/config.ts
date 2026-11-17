const env = process.env;

export const config = {
  port: Number(env.PORT) || 4000,
  host: env.HOST || '0.0.0.0',
  databaseUrl: (env.DATABASE_URL || '').trim(),
  databaseSsl: env.DATABASE_SSL === 'true',
  dbPoolMax: Number(env.DB_POOL_MAX) || 10,
  sessionSecret: env.SESSION_SECRET || '',
  n8nBase: (env.N8N_BASE_URL || 'https://n8n.webbea.qa').replace(/\/+$/, ''),
  n8nSecret: env.N8N_WEBHOOK_SECRET || '',
  publicAppUrl: (env.PUBLIC_APP_URL || '').replace(/\/+$/, ''),
  runScheduler: env.RUN_SCHEDULER !== 'false',
  isProd: env.NODE_ENV === 'production',
};

export function assertConfig() {
  const problems: string[] = [];
  if (!config.databaseUrl) problems.push('DATABASE_URL is not set');
  if (!config.sessionSecret || config.sessionSecret.length < 16) problems.push('SESSION_SECRET must be set (16+ characters) and equal the web app SESSION_SECRET');
  if (problems.length) throw new Error('Backend configuration error: ' + problems.join('; '));
}
