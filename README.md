# AtliQ Sales Memory Assistant — Prototype

A middle-layer AI system that reads AtliQ's sales activity (emails, meeting
notes, WhatsApp/call summaries pasted in by hand), extracts CRM-relevant
signals with a citation back to the exact source line, and either
auto-applies low-risk changes or queues judgment calls for founder approval.
See `../03 - Architecture` and `../05 - PRD` for the full design decisions
this implements.

Live at: **atliq.vercel.app** (shared password - see `.env.local` on the
deploying machine, or ask Kajal).

## What it does today

- **Single-pass extraction core** (`src/lib/extraction/`) - one Claude Opus
  4.8 call per source event pulls every applicable signal (new lead,
  deadline, negotiation flag, deferral, stage change, cross-sell,
  disqualification), each with a confidence level and the exact quoted line
  it came from.
- **3-tier automation** (`src/lib/automation/tiers.ts`) - `auto_apply`
  (forward stage progression), `approval_required` (new leads, deferrals,
  negotiation flags, cross-sell), `needs_review` (backward stage moves).
  Nothing except forward stage moves ever changes the CRM without a human
  tapping Approve.
- **Three intake paths, one pipeline** - every path below runs through the
  exact same extraction + tiering logic, so the Approval Inbox and Weekly
  Digest don't need to know or care where a signal came from:
  - **Backfill** (`src/scripts/backfill.ts`) - the original 40 CRM rows + 34
    emails + 15 meeting notes, seeded and processed once.
  - **Quick capture** (`src/app/dashboard/quick-capture-actions.ts`) - a
    paste-in box (sticky launcher button on every page, plus an inline
    section on Home) for WhatsApp messages, call summaries, or anything else
    that never touched email. Lets you pick the deal explicitly (auto-detect
    from text, mark as a brand-new lead, or attach to a specific deal by
    name) instead of relying purely on text matching.
  - *(Gmail live-inbox sync was built, then deliberately removed - see
    "What got removed" below. Quick capture covers the same "channel that
    isn't wired to a connector" need without the OAuth/verification
    overhead.)*
- **Approval Inbox** (`src/app/dashboard/approvals/`) - type-filterable list
  of everything waiting on a human, with the citation quote and model's
  reasoning behind a "Why is this here?" disclosure, edit-before-approve for
  proposed values, and a confirmation popup before every Approve/Reject.
- **Weekly Digest** (`src/app/dashboard/digest/`) - time-horizon buckets
  (due today, due in 2 weeks, needs review, stale, later) plus a
  pipeline-value-at-risk banner.
- **Deal Timeline** (`src/app/dashboard/deals/`) - sortable/filterable table
  of every open deal, and a per-deal page showing the full source-event +
  audit-log history with citations.
- **Home dashboard** (`src/app/dashboard/page.tsx`) - the numbers behind the
  digest at a glance: open pipeline, pending approvals, stale deals, win
  rate, pipeline-by-stage and by-owner breakdowns.
- **Daily digest email** (`src/lib/email/`) - sent via Resend (API key only,
  no OAuth), with one-tap Approve/Reject links straight from the inbox.
  Recipients and the automatic-send on/off switch are both managed from
  **Settings** in the app (`src/lib/digest/recipients.ts`, backed by the
  `DigestRecipient`/`DigestSetting` tables) - no env var editing needed.
  There's also a "Send test digest now" button in Settings that bypasses the
  on/off switch for one-off manual sends.
- **Handoff brief generator** (`src/app/api/handoff-brief/`) - on-demand AI
  summary of a single deal or the whole pipeline, for handing off context.
- **Deferral reach-back** (`src/lib/automation/deferral.ts`) - when a
  deferred deal's resurfacing date arrives, it fires a reminder signal with
  a drafted follow-up email waiting in the Approval Inbox.
- **Deterministic post-processing** - owner auto-assignment
  (`owner.ts`), duplicate-deal merge (`dedupe.ts`), and 30-day stale
  flagging (`stale.ts`), all run outside the AI call so they're predictable.
- **Shared access gate** (`src/app/login/` + `src/middleware.ts`) - one
  admin password for all four users (v1 access decision), with an "acting
  as" name picker so the audit trail still shows a real person instead of
  "admin."
- **Confirmation popups everywhere** - every button that changes data
  (approve/reject, sign out, generate a brief, log a quick capture, add/
  remove a digest recipient, toggle automatic sending) pops a small "are you
  sure" dialog naming the exact action first (`src/app/dashboard/_components/ConfirmButton.tsx`).

## Design

Warm editorial style: forest-green/cream palette, serif-italic accents for
brand and numbers, white cards with thin borders elsewhere. Logo is a small
forest-green icon mark (a hand-drawn Tabler-style brain outline) next to the
"atliq" wordmark and the tagline "The CRM that remembers"
(`src/components/AtliqLogo.tsx`), reused in the header and footer. Nav
underlines the active page; the wordmark itself links home (no separate
"Home" link). Visible keyboard-focus rings site-wide.

## What got removed

The Gmail OAuth connector (read a live inbox automatically) was built, then
deliberately shelved in favor of quick capture + the Resend-based digest -
same "channel that isn't wired to a connector" problem, without a Google
Cloud project, OAuth consent screen, or verification step to maintain for
four internal users. The connect/callback/sync code under `src/lib/gmail/`
and `src/app/api/gmail/` is a dead placeholder (kept only because of a
sandbox file-deletion limitation during development) - safe to delete:

```bash
rm -rf "src/lib/gmail" "src/app/api/gmail" "src/app/dashboard/settings/_SyncButton.tsx"
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

Copy `.env.example` to `.env.local` and fill in:

- `DATABASE_URL` - from your Vercel Postgres (Neon) database.
- `ANTHROPIC_API_KEY` - from console.anthropic.com.
- `ADMIN_PASSWORD` - shared password for the team.
- `SESSION_SECRET`, `CRON_SECRET` - any long random strings.
- `RESEND_API_KEY` - from resend.com, for the daily digest email. Optional
  for local testing - without it, digest sending just no-ops.
- `APP_BASE_URL` - `http://localhost:3000` locally.

### 3. Apply database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

Run both, in that order, every time `prisma/schema.prisma` changes - `deploy`
applies pending SQL migrations, `generate` rebuilds the TypeScript client
your code actually imports. Skipping `generate` (or not fully restarting
`npm run dev` afterward) is the most common cause of a
`Cannot read properties of undefined (reading 'findMany')` error on a page
that queries a newly-added table.

### 4. Run the backfill (one-time seed)

```bash
npm run backfill
```

Makes ~49 real Claude calls (costed out in `../04 - Cost Estimation`) - uses
your Anthropic API key and takes a few minutes.

### 5. Run the app locally

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in with `ADMIN_PASSWORD`.

### 6. Manage the daily digest

In the app, go to **Settings** → add recipient emails, toggle automatic
sending on/off, and use "Send test digest now" to confirm Resend is wired up
(needs `RESEND_API_KEY` in `.env.local` first). Until a sending domain is
verified on Resend, it can only deliver to the email address the Resend
account itself signed up with.

## Deploying to Vercel

1. Push to the GitHub repo this project is already connected to
   (`github.com/Kajal459/atliq`).
2. In Vercel's Project Settings → Environment Variables, make sure these are
   set for Production: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
   `ADMIN_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, `RESEND_API_KEY`,
   `APP_BASE_URL` (your production URL, e.g. `https://atliq.vercel.app`).
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`DIGEST_RECIPIENTS` are no
   longer used - fine to remove if present.
3. Vercel auto-deploys on push. The `build` script runs `prisma generate`
   automatically, but it does **not** run `migrate deploy` - if this deploy
   includes a schema change, run `npx prisma migrate deploy` yourself once
   against the production `DATABASE_URL` (either locally with `.env.local`
   pointed at prod, or via `vercel env pull`) before or right after the
   deploy finishes, so the live database has the matching tables.
4. `vercel.json` registers a daily cron job (`/api/cron`, 6am UTC - Hobby
   plan's once-a-day limit) that re-checks stale deals, fires due deferral
   reminders, and sends the digest email (unless paused in Settings).
5. After deploying, open Settings on the production URL and re-add digest
   recipients - they live in the database, not in env vars, so they don't
   carry over from a previous deploy or from local testing.

## Known simplifications

- **Company matching** for quick capture's "auto-detect" mode and the
  original backfill is a plain substring match on company name - good enough
  for this dataset; real entity resolution (embeddings) would be the next
  step at higher volume, per the cost estimation worksheet's embedding line.
  The "attach to a specific deal" dropdown in quick capture sidesteps this
  entirely when the match matters.
- **No per-user accounts** - one shared password, matching the v1 access
  decision. The "acting as" / "Logged by" pickers are how the audit trail
  still gets a real name.
- **FR-11 (reply-to-digest updates)** shares the same extraction pipeline as
  everything else but isn't wired to a live inbox - a founder's reply would
  need to come in through quick capture until/unless a real reply-tracking
  channel is built.
- **Cron only runs once deployed to Vercel.** Locally, trigger it by hand:
  `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron`.
- **Digest send time is fixed in `vercel.json`** (currently 6am UTC) - the
  Settings toggle controls whether that daily run sends, not what time it
  fires. Changing the time itself means editing `vercel.json` and
  redeploying.
