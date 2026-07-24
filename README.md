# AtliQ Sales Memory Assistant — Prototype

This is the working prototype for the capstone: a middle-layer AI system that
reads AtliQ's emails and meeting notes, extracts CRM-relevant signals with a
citation to their source, and either auto-applies low-risk changes or queues
judgment calls for founder approval. See `../03 - Architecture` and
`../05 - PRD` for the full design decisions this implements.

**First build scope (this version):** backfill the existing dataset (40 CRM
rows, 34 emails, 15 meeting notes, already copied into `data/`) and get the
three dashboard views working. The live Gmail connector is a deliberate
next step, added once this core is working end to end.

## What's in here

- `prisma/schema.prisma` — the database: `Deal` (the CRM record), `SourceEvent`
  (a raw email/note, kept for citation), `Signal` (an extracted proposed
  change — this IS the Approval Queue), `AuditLog`.
- `src/lib/extraction/` — the single-pass Claude Opus 4.8 extraction call.
- `src/lib/automation/` — the 3-tier routing (auto-apply / approval-required /
  needs-review), owner auto-assignment, duplicate merge, stale-flag logic.
- `src/scripts/backfill.ts` — seeds the CRM, then runs every email/note
  through extraction in chronological order.
- `src/app/dashboard/` — Weekly Digest (default view), Approval Inbox, Deal
  Timeline.
- `src/app/login/` + `src/middleware.ts` — the shared admin-password gate
  (v1 access decision: one role for all four users, no per-user accounts).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` — from your Vercel Postgres database (Vercel dashboard →
  Storage → your database → `.env.local` tab → copy the connection string).
- `ANTHROPIC_API_KEY` — from console.anthropic.com.
- `ADMIN_PASSWORD` — any shared password for the four of you.
- `SESSION_SECRET` — any long random string (e.g. `openssl rand -hex 32`).

### 3. Create the database tables

```bash
npx prisma migrate dev
```

This connects to the Postgres database at `DATABASE_URL` and applies every
migration in `prisma/migrations/` (including the FR-8/FR-9/FR-12 follow-up
migration - no need to pass `--name`, it'll just apply what's already there).

### 4. Run the backfill

```bash
npm run backfill
```

This makes ~49 real calls to Claude (one per email/note — costed out in
`../04 - Cost Estimation`), so it uses your Anthropic API key and will take a
few minutes. Watch the console output — it prints which deal each item
matched and what got auto-applied.

### 5. Run the app locally

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `ADMIN_PASSWORD`, and you should
see the Weekly Digest populated from the backfill.

## Deploying to Vercel

1. Push this folder to a GitHub repo (or use `vercel` CLI directly from here).
2. In the Vercel dashboard, import the repo, and add the same environment
   variables from `.env.local` (`DATABASE_URL`, `ANTHROPIC_API_KEY`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`, `ANTHROPIC_MODEL`, `CRON_SECRET`) under
   Project Settings → Environment Variables.
3. If you created the Postgres database from the same Vercel project's
   Storage tab, `DATABASE_URL` may already be linked automatically.
4. Deploy. The `build` script runs `prisma generate` automatically before
   `next build`. `vercel.json` registers a daily cron job (`/api/cron`, once
   a day - Hobby plan's limit) that re-checks stale deals and fires any due
   deferral reach-back reminders.
5. Run the backfill once against the production database — either run it
   locally with `DATABASE_URL` pointed at production, or trigger it as a
   one-off Vercel CLI command (`vercel env pull` then `npm run backfill`
   locally is simplest for a one-time seed).

## Known simplifications in this pass

- **Company matching** is a plain substring match on company name — good
  enough for this dataset, would need real entity resolution (embeddings) at
  higher volume, per the cost estimation worksheet's embedding line.
- **No live Gmail connector yet** — that's the next build step per the
  "core first, Gmail last" decision.
- **No per-user accounts** — one shared password for all four users, matching
  the v1 access decision. The "acting as" dropdown on Approval Inbox actions
  is how the audit trail still gets a real name instead of "admin".
- **FR-11 (reply-to-digest updates)** isn't wired to a live inbox yet either —
  it shares the same extraction pipeline, so it'll plug in once Gmail
  watching exists; for now, a founder's reply would need to be pasted in via
  a "meeting note"-style manual entry if you want to demo it before Gmail is
  connected.
- **The daily cron job only runs once deployed to Vercel** — Vercel's
  scheduler triggers it, so locally you can only test `/api/cron` by hand:
  `curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron`.
