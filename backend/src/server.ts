import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import crypto from 'node:crypto';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { config, assertConfig } from './config.js';
import { migrate } from './migrate.js';
import { getPool, closePool } from './db.js';
import { q, tx } from './lib/db.js';
import { als } from './ctx.js';
import { signSession, verifySession, homeFor, type Session } from './lib/session.js';
import { Redirect, FormLike } from './compat.js';
import { actions, publicActions } from './actions/registry.js';
import { queries, NotFound, Forbidden } from './routes/queries.js';
import { callN8n, todayIST } from './lib/n8n.js';
import { holidayOn } from './lib/holidays.js';
import { saveWaStatus } from './lib/wa.js';
import { verifyToken } from './lib/sign.js';
import { loadCards, buildPdf, fileNameFor } from './lib/reportcard.js';
import { parseParams, scopeClassIds, studentSummary, absenteeList, classComparison, pct } from './lib/reports.js';
import { csvCell, fmtDate } from './lib/format.js';
import { startScheduler } from './scheduler.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
    clientIp: string;
  }
}

assertConfig();
const app = Fastify({
  logger: { level: config.isProd ? 'info' : 'debug', redact: ['req.headers.authorization'] },
  bodyLimit: 1_000_000,
  trustProxy: true,
  genReqId: () => crypto.randomUUID().slice(0, 8),
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(rateLimit, {
  global: true,
  max: 600,
  timeWindow: '1 minute',
  keyGenerator: (req) => (req.session ? `u${req.session.uid}` : `ip${req.clientIp}`),
});

app.decorateRequest('session', null);
app.decorateRequest('clientIp', '');

// Every request: find who is calling (Bearer token = the web app's session cookie) and make that
// session available to the action modules through AsyncLocalStorage.
app.addHook('onRequest', (req, _reply, done) => {
  req.clientIp = String(req.headers['x-client-ip'] || req.ip || '').split(',')[0].trim();
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  (token ? verifySession(token) : Promise.resolve(null)).then((session) => {
    req.session = session;
    als.run({ session, reqId: req.id }, done);
  });
});

app.setErrorHandler((err: any, req, reply) => {
  if (err instanceof z.ZodError) return reply.code(400).send({ ok: false, error: 'Invalid request', details: err.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) });
  if (err?.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ ok: false, error: err.message });
  req.log.error({ err }, 'unhandled error');
  return reply.code(500).send({ ok: false, error: 'Something went wrong. Please try again.' });
});

const needSession = (req: FastifyRequest, reply: FastifyReply, roles?: Session['role'][]): Session | null => {
  const s = req.session;
  if (!s) {
    reply.code(401).send({ ok: false, error: 'Please sign in again' });
    return null;
  }
  if (roles && !roles.includes(s.role)) {
    reply.code(403).send({ ok: false, error: 'Not allowed', home: homeFor(s.role) });
    return null;
  }
  return s;
};

/* ------------------------------ health ------------------------------ */
app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
  try {
    await q('SELECT 1');
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false });
  }
});

/* ------------------------------ auth ------------------------------ */
const failures = new Map<string, { n: number; until: number }>();
const LoginBody = z.object({ email: z.string().trim().toLowerCase().min(3).max(200), password: z.string().min(1).max(200) });

app.post('/v1/auth/login', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, async (req, reply) => {
  const { email, password } = LoginBody.parse(req.body);
  const key = `${email}|${req.clientIp}`;
  const f = failures.get(key);
  if (f && f.until > Date.now() && f.n >= 8) return reply.code(429).send({ ok: false, error: 'locked' });
  const [u] = await q(
    `SELECT u.id, u.name, u.role, u.password_hash, u.school_id, s.active AS school_active FROM att.users u LEFT JOIN att.schools s ON s.id = u.school_id WHERE u.email = $1`,
    [email]
  );
  const good = u ? await bcrypt.compare(password, u.password_hash) : await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !good) {
    failures.set(key, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    q(`INSERT INTO att.audit_log (action, target, ip, ok) VALUES ('login', $1, $2, FALSE)`, [email, req.clientIp]).catch(() => {});
    return reply.code(401).send({ ok: false, error: 'invalid' });
  }
  failures.delete(key);
  if (u.role !== 'superadmin' && u.school_active === false) return reply.code(403).send({ ok: false, error: 'suspended' });
  const session: Session = { uid: u.id, role: u.role, name: u.name, sid: u.school_id ?? 0 };
  q(`INSERT INTO att.audit_log (user_id, school_id, action, ip) VALUES ($1,$2,'login',$3)`, [u.id, u.school_id, req.clientIp]).catch(() => {});
  return { ok: true, token: await signSession(session), home: homeFor(u.role) };
});

/* ------------------------------ actions (all changes) ------------------------------ */
const ActionBody = z.object({
  fields: z
    .record(z.string().max(100), z.union([z.string().max(200_000), z.array(z.string().max(2000)).max(500)]))
    .refine((o) => Object.keys(o).length <= 400, 'too many fields'),
});

app.post('/v1/actions/:name', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
  const name = String((req.params as any).name);
  const fn = actions[name];
  if (!fn) return reply.code(404).send({ ok: false, error: 'Unknown action' });
  if (publicActions.has(name)) {
    // forgot-password: tighter limit per IP
    const k = `pub:${req.clientIp}`;
    const hit = failures.get(k);
    if (hit && hit.until > Date.now() && hit.n >= 20) return reply.code(429).send({ ok: false, error: 'Too many attempts. Try again later.' });
    failures.set(k, { n: (hit && hit.until > Date.now() ? hit.n : 0) + 1, until: hit && hit.until > Date.now() ? hit.until : Date.now() + 15 * 60_000 });
  } else if (!req.session) {
    return reply.code(401).send({ ok: false, error: 'Please sign in again', redirect: '/login' });
  }
  const { fields } = ActionBody.parse(req.body);
  let redirectTo: string | null = null;
  let ok = true;
  try {
    await fn(new FormLike(fields));
  } catch (e) {
    if (e instanceof Redirect) redirectTo = e.path;
    else throw e;
  }
  if (redirectTo) ok = !/[?&]err=/.test(redirectTo);
  const s = req.session;
  q(`INSERT INTO att.audit_log (user_id, school_id, action, target, ip, ok) VALUES ($1,$2,$3,$4,$5,$6)`, [s?.uid ?? null, s?.sid || null, name, (redirectTo || '').slice(0, 200), req.clientIp, ok]).catch(() => {});
  return { ok, redirect: redirectTo };
});

/* ------------------------------ page data ------------------------------ */
app.get('/v1/q/:name', async (req, reply) => {
  const def = queries[String((req.params as any).name)];
  if (!def) return reply.code(404).send({ ok: false, error: 'Unknown query' });
  const s = needSession(req, reply, def.roles);
  if (!s) return;
  try {
    const data = await def.fn(s, req.query as Record<string, string>);
    reply.header('cache-control', 'private, no-store');
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Redirect) return { ok: true, redirect: e.path };
    if (e instanceof NotFound) return reply.code(404).send({ ok: false, error: 'Not found' });
    if (e instanceof Forbidden) return reply.code(403).send({ ok: false, error: 'Not allowed' });
    throw e;
  }
});

/* ------------------------------ attendance ------------------------------ */
const AttBody = z.object({
  class_id: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session: z.enum(['morning', 'afternoon']),
  marks: z.array(z.object({ student_id: z.coerce.number().int(), status: z.enum(['P', 'A']) })).max(500),
});

app.post('/v1/attendance', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
  const s = needSession(req, reply, ['teacher']);
  if (!s) return;
  const parsed = AttBody.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ ok: false, error: 'Bad request' });
  const { class_id: classId, date, session, marks } = parsed.data;
  const today = todayIST();
  const minDate = new Date(Date.parse(today) - 2 * 86400000).toISOString().slice(0, 10);
  if (date > today || date < minDate) return reply.code(400).send({ ok: false, error: 'Date must be within the last 2 days' });
  const holiday = await holidayOn(s.sid, date);
  if (holiday) return reply.code(400).send({ ok: false, error: `${date} is a holiday (${holiday}). Attendance cannot be marked.` });
  const own = await q(`SELECT id FROM att.classes WHERE id = $1 AND teacher_id = $2`, [classId, s.uid]);
  if (!own.length) return reply.code(403).send({ ok: false, error: 'Not your class' });

  const roster = await q<{ id: number }>(`SELECT id FROM att.students WHERE class_id = $1 AND active`, [classId]);
  const allowed = new Set(roster.map((r) => r.id));
  const wanted = new Map<number, string>();
  for (const m of marks) if (allowed.has(m.student_id)) wanted.set(m.student_id, m.status);
  if (wanted.size !== roster.length) return reply.code(400).send({ ok: false, error: 'Mark every student before submitting' });
  const ids = [...wanted.keys()];
  const statuses = ids.map((id) => wanted.get(id)!);

  // One transaction: attendance + the WhatsApp queue. If n8n is down nothing is lost; the sweeper retries.
  const queued = await tx(async (run) => {
    await run(
      `DELETE FROM att.message_log ml USING att.attendance a
       JOIN unnest($1::int[], $2::text[]) AS x(id, st) ON x.id = a.student_id
       WHERE ml.attendance_id = a.id AND a.att_date = $3::date AND a.session = $4 AND a.status <> x.st`,
      [ids, statuses, date, session]
    );
    await run(
      `INSERT INTO att.attendance (student_id, att_date, session, status, marked_by)
       SELECT x.id, $3::date, $4, x.st, $5 FROM unnest($1::int[], $2::text[]) AS x(id, st)
       ON CONFLICT (student_id, att_date, session) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()`,
      [ids, statuses, date, session, s.uid]
    );
    await run(
      `INSERT INTO att.session_marks (class_id, att_date, session, marked_by) VALUES ($1,$2::date,$3,$4)
       ON CONFLICT (class_id, att_date, session) DO UPDATE SET marked_by = EXCLUDED.marked_by, marked_at = now()`,
      [classId, date, session, s.uid]
    );
    const r = await run(
      `INSERT INTO att.message_log (attendance_id, guardian_id)
       SELECT a.id, g.id FROM att.attendance a JOIN att.guardians g ON g.student_id = a.student_id AND g.opt_in
       WHERE a.student_id = ANY($1::int[]) AND a.att_date = $2::date AND a.session = $3
       ON CONFLICT (attendance_id, guardian_id) DO NOTHING`,
      [ids, date, session]
    );
    return r.rowCount;
  });
  const n8n = await callN8n('attendance-submitted', { class_id: classId, att_date: date, session });
  q(`INSERT INTO att.audit_log (user_id, school_id, action, target, ip) VALUES ($1,$2,'attendance',$3,$4)`, [s.uid, s.sid, `class ${classId} ${date} ${session}`, req.clientIp]).catch(() => {});
  return { ok: true, saved: ids.length, queued, eta_minutes: Math.max(1, Math.ceil((queued * 9) / 60)), notify_started: n8n.ok };
});

/* ------------------------------ WhatsApp connect (through n8n / Evolution) ------------------------------ */
app.post('/v1/wa', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req, reply) => {
  const s = needSession(req, reply, ['teacher']);
  if (!s) return;
  const action = String((req.body as any)?.action || '');
  if (!['connect', 'status', 'logout'].includes(action)) return reply.code(400).send({ ok: false, error: 'bad action' });
  if (!config.n8nSecret || config.n8nSecret.startsWith('same-value')) {
    return reply.code(500).send({ ok: false, error: 'Server setup: N8N_WEBHOOK_SECRET is missing or still the placeholder in .env. Copy the real value, then restart the app.' });
  }
  const r = await callN8n('attendance-wa', { action, teacher_id: s.uid });
  if (r.status === 401) return reply.code(502).send({ ok: false, error: 'Server setup: N8N_WEBHOOK_SECRET does not match the secret in the n8n workflow. Fix .env and restart the app.' });
  if (r.status === 0) return reply.code(502).send({ ok: false, error: `Cannot reach n8n (${config.n8nBase}). Check the URL and network.` });
  if (r.status === 404) return reply.code(502).send({ ok: false, error: 'n8n webhook not found. Make sure the workflow "Attendance · WhatsApp Connect" is published.' });
  if (!r.ok) return reply.code(502).send({ ok: false, error: r.data?.error || `n8n responded ${r.status}` });
  if (action === 'status' || action === 'logout') await saveWaStatus(s.uid, r.data?.wa_status === 'connected' ? 'connected' : 'disconnected');
  return r.data;
});
app.get('/v1/wa', async (req, reply) => {
  const s = needSession(req, reply, ['teacher']);
  if (!s) return;
  const [u] = await q(`SELECT wa_status FROM att.users WHERE id = $1`, [s.uid]);
  return { ok: true, wa_status: u?.wa_status ?? 'disconnected' };
});

/* ------------------------------ files ------------------------------ */
// Report card PDF: a signed link (used by WhatsApp to fetch it) or a signed-in admin / class teacher.
app.get('/v1/files/report-card', async (req, reply) => {
  const u = req.query as Record<string, string>;
  const exam = Number(u.exam);
  const student = Number(u.student);
  const exp = Number(u.exp || 0);
  const sig = u.sig || '';
  if (!exam || !student) return reply.code(400).send('bad request');
  let ok = false;
  if (sig) ok = exp > Date.now() && verifyToken(`rc:${exam}:${student}:${exp}`, sig);
  else if (req.session?.role === 'admin') ok = (await q(`SELECT 1 FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.school_id = $2`, [exam, req.session.sid])).length > 0;
  else if (req.session?.role === 'teacher') ok = (await q(`SELECT 1 FROM att.exams e JOIN att.classes c ON c.id = e.class_id WHERE e.id = $1 AND c.teacher_id = $2`, [exam, req.session.uid])).length > 0;
  if (!ok) return reply.code(403).send('forbidden');
  const [card] = await loadCards(exam, student);
  if (!card) return reply.code(404).send('not found');
  const bytes = await buildPdf([card]);
  return reply.header('content-type', 'application/pdf').header('content-disposition', `inline; filename="${fileNameFor(card)}"`).header('cache-control', 'private, no-store').send(Buffer.from(bytes));
});

app.get('/v1/files/reports.csv', async (req, reply) => {
  const s = needSession(req, reply, ['admin', 'teacher']);
  if (!s) return;
  const p = parseParams(req.query as any, s.role);
  const ids = await scopeClassIds(s, p.classId);
  let head: string[] = [];
  let rows: unknown[][] = [];
  if (p.type === 'students') {
    head = ['Class', 'Roll', 'Student', 'Present sessions', 'Absent sessions', 'Marked sessions', 'Attendance %'];
    rows = (await studentSummary(ids, p.from, p.to)).map((r) => [r.class_name, r.roll_no, r.name, r.present, r.absent, r.total, pct(r.present, r.total)?.toFixed(1) ?? '']);
  } else if (p.type === 'absentees') {
    head = ['Date', 'Session', 'Class', 'Roll', 'Student', 'Parent WhatsApp'];
    rows = (await absenteeList(ids, p.from, p.to)).map((r) => [fmtDate(r.d), r.session, r.class_name, r.roll_no, r.name, r.phone ?? '']);
  } else {
    head = ['Class', 'Class teacher', 'Students', 'Present sessions', 'Absent sessions', 'Marked sessions', 'Attendance %'];
    rows = (await classComparison(ids, p.from, p.to)).map((r) => [r.class_name, r.teacher ?? '', r.students, r.present, r.absent, r.total, pct(r.present, r.total)?.toFixed(1) ?? '']);
  }
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="attendance-${p.type}-${p.from}-to-${p.to}.csv"`).header('cache-control', 'no-store').send(csv);
});

/* ------------------------------ start ------------------------------ */
await migrate((m) => app.log.info(m));
getPool();
await app.listen({ port: config.port, host: config.host });
if (config.runScheduler) startScheduler((m) => app.log.info(m));

const stop = async () => {
  await app.close();
  await closePool();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
