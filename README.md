# School Attendance → WhatsApp (Next.js dashboard)

Teachers mark Morning/Afternoon attendance (✓ green / ✗ red). Parents get a WhatsApp message via
n8n (n8n.webbea.qa) and Evolution API (evolution.webbea.qa), sent from the class teacher's own number.

## Architecture (v3): thin web app + API server

```
Browser -> Next.js web app (UI only) -> API server (backend/, Fastify + PostgreSQL) -> n8n (WhatsApp sending only)
```
- **backend/** is the only thing that touches the database. It has the business rules, school/class access checks, validation (zod), rate limiting, audit log, caching, pagination, PDF and CSV generation, the durable WhatsApp queue and the background jobs (queue sweeper every 2 min, 3-day absence alert daily 17:30 IST). Database changes are numbered files in `backend/migrations` applied automatically at start (tracked in `att.schema_migrations`).
- **The web app** (Next.js) only renders pages. It calls the API with the signed-in session token and has no database, bcrypt or PDF code, so it is small and fast.
- **n8n** now only sends WhatsApp messages (send queue, notices, media, WhatsApp connect). The old n8n *Consecutive Absence Alert* and *Queue Sweeper* workflows are replaced by the API jobs; once the API is running you can unpublish those two in n8n (running both is harmless, the SQL is idempotent).
- The API is **not published** to the internet (only the web app container can reach it). The report-card link sent on WhatsApp still uses `PUBLIC_APP_URL` and is proxied by the web app.
- Env: the API needs `DATABASE_URL`, `SESSION_SECRET` (same value as the web app), `N8N_BASE_URL`, `N8N_WEBHOOK_SECRET`, `PUBLIC_APP_URL`. The web app needs `API_URL` (set by compose), `SESSION_SECRET`, `COOKIE_SECURE`.
- Local dev: `cd backend && npm i && npm run dev`, then `npm run dev` in the repo root with `API_URL=http://localhost:4000`.

## Docker (recommended) - with its own SchoolDB
```
cp .env.example .env     # set SCHOOLDB_PASSWORD, SESSION_SECRET, N8N_WEBHOOK_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```
This starts: `schooldb` (Postgres, database `schooldb`), `api` (the API server) and `api-setup` (creates the first admin / super admin, safe to re-run) and `app` on http://localhost:3000.

### Connect n8n to SchoolDB (required)
The n8n workflows read/write the same data, so in n8n create a Postgres credential named **SchoolDB Postgres**:
host = this server's address, port = 5433, database = schooldb, user/password = SCHOOLDB_USER / SCHOOLDB_PASSWORD.
Then point the 3 "Attendance ·" workflows at that credential. Restrict port 5433 in the firewall to the n8n server.

## Manual setup
1. Database: tables already created in schema `att` (see backend/migrations). Use the same Postgres as the n8n "Postgres account" credential.
2. `.env.local`: set `DATABASE_URL` (and `DATABASE_SSL=true` if needed). `N8N_WEBHOOK_SECRET` is already filled in.
3. `npm install`
4. Create admin: `ADMIN_EMAIL=you@school.in ADMIN_PASSWORD=choose-strong ADMIN_NAME=Principal node --env-file=.env.local scripts/seed-admin.mjs`
5. `npm run build && npm start` (set `COOKIE_SECURE=true` when serving over HTTPS).

## n8n workflows (all on n8n.webbea.qa)
- Attendance · WhatsApp Connect (published): QR / status / logout
- Attendance · Send Parent Messages (published): queue, throttle 5–12s, log, summary to teacher
- Attendance · Reminders & Retry (NOT published yet): publish after checking schedule timezone (Asia/Kolkata)
- Attendance · DB Setup (run once): already executed; can be archived

## Production: run the dashboard on the n8n server (important)

The dashboard and n8n must use the **same** database. If the dashboard runs on your
own PC with its own `schooldb`, attendance is saved there while n8n reads the server
database, so no WhatsApp messages are sent.

On the server that runs n8n and the `schooldb` container:

```bash
git clone https://github.com/nihal8547/School-Attendence-.git && cd School-Attendence-
cp .env.example .env        # fill SCHOOLDB_PASSWORD (same as the n8n credential), SESSION_SECRET, N8N_WEBHOOK_SECRET
docker compose -f docker-compose.server.yml up -d --build
```

Stop the local copy (`docker compose down`) so nobody marks attendance in the wrong database.

## Modules (v2)

- **Holiday calendar** – admin adds holidays/ranges (optional WhatsApp notice); attendance is blocked on holidays.
- **Announcements** – admin to all parents, teachers to their own class, sent via the class teacher's WhatsApp.
- **Reports & export** – student-wise %, absentee list, class comparison; CSV download and print.
- **Fees** – fee items per class, concessions, payments, printable receipts, WhatsApp reminders/receipts.
- **Report card PDF** – per-student PDF, print-all page, and send PDFs to parents on WhatsApp.
- **Consecutive absence alert** – n8n workflow "Attendance · Consecutive Absence Alert" runs daily 5:30 PM IST and alerts parents + class teacher after 3 school days absent in a row.
- **Account** – change password, profile, school name/address; forgot password with a WhatsApp OTP; admin can reset teacher passwords.

### Extra setting
Set `PUBLIC_APP_URL` in `.env` (e.g. `https://sa.nihalbabu.in`) so report-card PDF links can be fetched by WhatsApp. Report-card PDFs support Latin names only (other scripts show as `?` in the PDF; the print page supports all).

### Sending queue (many teachers at once)
Submitting attendance saves the marks **and** queues every parent message in one DB transaction, so a busy/down n8n never loses anything. n8n sends each teacher's messages one by one (5–12 s gap + typing delay) from that teacher's own WhatsApp; different teachers send in parallel. Messages are claimed with `FOR UPDATE SKIP LOCKED` (no duplicates), and the "Queue Sweeper" workflow (every 2 min) restarts anything stuck or failed (max 3 tries).

## Multi-school, Super Admin, Class Groups & Modules

- **Super Admin** (`/super`): creates schools, adds a school admin for each, suspends a school, and switches modules on/off per school. Create one with `SUPERADMIN_EMAIL` + `SUPERADMIN_PASSWORD` (min 8 chars) in `.env`, then run `docker compose -f docker-compose.server.yml run --rm api-setup`. Change the password in *My Account* after the first login.
- **Existing data** becomes school 1 automatically (schema migration runs on first page load).
- **Class Groups** (`/admin/groups`): school admin makes groups (Primary, Upper Primary, Secondary…), assigns classes to a group, and switches modules per group. A module is active for a class only if the school has it ON *and* its group does not turn it OFF.
- **Grading scheme per group**: `marks` (total, %, rank) or `grades` (subject and overall grades only; rank optional). Used in mark sheets, WhatsApp results and report cards.
- **Academic modules**: Homework, Syllabus / Lesson plan, Leave requests, Remarks & Achievements (each can notify parents on WhatsApp), plus Timetable, Marks, Report cards, Fees, Announcements, Holidays, Reports.
- Attendance is always on. New modules default to ON for a school until the Super Admin turns them off.
