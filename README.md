# School Attendance → WhatsApp (Next.js dashboard)

Teachers mark Morning/Afternoon attendance (✓ green / ✗ red). Parents get a WhatsApp message via
n8n (n8n.webbea.qa) and Evolution API (evolution.webbea.qa), sent from the class teacher's own number.

## Docker (recommended) - with its own SchoolDB
```
cp .env.example .env     # set SCHOOLDB_PASSWORD, SESSION_SECRET, N8N_WEBHOOK_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
```
This starts three things: `schooldb` (Postgres, database `schooldb`), `db-setup` (creates the `att` schema + admin, safe to re-run) and `app` on http://localhost:3000.

### Connect n8n to SchoolDB (required)
The n8n workflows read/write the same data, so in n8n create a Postgres credential named **SchoolDB Postgres**:
host = this server's address, port = 5433, database = schooldb, user/password = SCHOOLDB_USER / SCHOOLDB_PASSWORD.
Then point the 3 "Attendance ·" workflows at that credential. Restrict port 5433 in the firewall to the n8n server.

## Manual setup
1. Database: tables already created in schema `att` (see db/schema.sql). Use the same Postgres as the n8n "Postgres account" credential.
2. `.env.local`: set `DATABASE_URL` (and `DATABASE_SSL=true` if needed). `N8N_WEBHOOK_SECRET` is already filled in.
3. `npm install`
4. Create admin: `ADMIN_EMAIL=you@school.in ADMIN_PASSWORD=choose-strong ADMIN_NAME=Principal node --env-file=.env.local scripts/seed-admin.mjs`
5. `npm run build && npm start` (set `COOKIE_SECURE=true` when serving over HTTPS).

## n8n workflows (all on n8n.webbea.qa)
- Attendance · WhatsApp Connect (published): QR / status / logout
- Attendance · Send Parent Messages (published): queue, throttle 5–12s, log, summary to teacher
- Attendance · Reminders & Retry (NOT published yet): publish after checking schedule timezone (Asia/Kolkata)
- Attendance · DB Setup (run once): already executed; can be archived
