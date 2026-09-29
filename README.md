# Amebo — Pipeline Clean (v1)

AI pre-screening for accelerator and incubator application pipelines. Upload
the intake CSV export and pitch decks; the classifier sorts applications into
SHORTLIST / REVIEW_QUEUE / AUTO_FILTERED against your mandate rubric, with
evidence-linked rationales, a human review queue, audit trail, and a live
cost meter. See the PRD for product context.

## Stack

TypeScript end to end. Next.js 15 (App Router), Drizzle ORM + Postgres,
Auth.js v5 (Google OAuth only), Vitest, Zod.

> **Pin:** `typescript` is pinned to **5.9**. Next 15.5's tsconfig-paths
> plugin and config loader break against TypeScript 7's compiler API
> (symptom: `Module not found: Can't resolve '@/…'` and
> `Cannot read properties of undefined (reading 'fileExists')`).
> Do not bump to TS 7 until Next declares support.

## Setup

```bash
npm install
cp .env.example .env       # fill in DATABASE_URL, Google OAuth, AUTH_SECRET
npm run db:generate        # regenerate SQL after schema changes (checked in)
psql "$DATABASE_URL" -f drizzle/0000_hot_purifiers.sql
npm test                   # 58 unit tests, no DB or network needed
npm run dev
```

## Provisioning (manual in v1 — by design)

There is no self-serve signup. Insert the org, users, memberships, and the
cycle by hand:

```sql
INSERT INTO orgs (name) VALUES ('Catapult') RETURNING id;
INSERT INTO users (email, name) VALUES ('shiv@catapult.example', 'Shiv') RETURNING id;
INSERT INTO memberships (org_id, user_id, role) VALUES ('<org>', '<user>', 'admin');
INSERT INTO cycles (org_id, name, mandate_config, threshold, model_id) VALUES (
  '<org>', '2027 Cohort',
  '{"programName":"Catapult 2027","stages":["pre_seed","seed"],
    "sectors":["Fintech","Healthtech","Agritech","Logistics"],
    "geographies":["Nigeria","Ghana","Kenya"],
    "additionalCriteria":"Prefer post-revenue teams."}',
  0.85, 'anthropic:claude-sonnet-4-6'
);
```

`model_id` is `vendor:model`; the vendor's API key must be in the
environment (see `.env.example` and `src/core/classify/providerRegistry.ts`).
Unknown Google accounts get a clean 403 — a role change takes effect on the
next request, not the next sign-in.

Users open the app as `/?orgId=<org>&cycleId=<cycle>`.

## Local development without OAuth or API keys

Two switches, **local testing only — never set in a deployed environment**:

- `DEV_AUTH_EMAIL=<email>` in `.env` bypasses Google OAuth and treats every
  request as that user (who still needs a membership row).
- A cycle with `model_id = 'mock:heuristic'` classifies with a keyword
  stand-in (`src/core/classify/providers/devHeuristic.ts`), so the full
  upload → classify → review flow works with no provider keys.

Quick Postgres: `docker run -d --name amebo-pg -e POSTGRES_USER=amebo -e POSTGRES_PASSWORD=amebo -e POSTGRES_DB=amebo -p 55432:5432 postgres:16`

## UI

The dashboard shows the pipeline as a **Board** (columns per bucket, drag
cards between them; only moves allowed by the review state machine are
accepted) or a **Table** (sortable, status filters). Click any application
for full details, evidence, and review actions. The shortlist CSV download
is in the toolbar of both views. Screening cost is Amebo-internal: recorded
in `cost_events`, not shown to customer orgs.

## Intake form

`docs/intake/` has the Google Form builder (Apps Script), the intake CSV
JSON Schema, and the spec, including the known deck-matching gap with
Google Forms file uploads.

## End-to-end demo (live DB, no API keys)

```bash
DATABASE_URL=postgres://… npx vite-node --config vitest.config.ts scripts/demo-e2e.ts
```

Seeds a demo org and cycle, ingests the mock Catapult fixture, classifies
with a scripted mock provider (all three buckets exercised, including a
72%-confidence keep that the gate correctly queues), performs review
actions including a relabel recorded as a training signal, prints the cost
meter and audit trail, and emits the shortlist CSV. Verified against
Postgres 16.

## The bake-off (internal harness, not a product surface)

Decide frontier vs open-weight per org with data, not vibes:

```bash
npm run bakeoff path/to/labeled-past-cycle.csv
```

Runs every provider that has an API key set, prints filter precision,
**false-negative rate** (the metric that matters — a wrongly rejected
fundable startup is the failure mode that kills trust), and cost per
application. With no keys set it runs a deterministic mock so the plumbing
is testable. Ground truth comes from the `Decision` column
(`Accepted`/`Interviewed` → keep, `Rejected*` → filter, else excluded).

Pricing lives in `src/core/classify/cost.ts` and is **config, not truth** —
refresh it from the provider price pages before each run.

## Design rules the code enforces

- **Fail safe:** anything the system cannot read or parse routes to the
  human queue, never to the auto-filtered pile. Auto-removal requires the
  model to be both *confident* and *rejecting*.
- **Data, not instructions:** founder-supplied text is delimiter-wrapped
  and sanitized; injection attempts are themselves a rationale signal.
- **Everything hashed:** the CSV and every deck get SHA-256 at ingest;
  missing and orphan decks are reported in the ingest response.
- **Overrides are the training signal:** reviewer relabels record
  `from → to` in `audit_events` with `is_training_signal = true`.
- **Multi-tenant everywhere:** every business table carries `org_id`, every
  query filters by it.

## Deliberate v1 gaps (documented, not accidental)

- Deck PDF text extraction (`deckText: null` at both call sites) — next increment.
- Per-call token counts in `cost_events` (cost USD is real; token columns are 0 until the job queue lands).
- Synchronous batch classification — fine at pilot scale, needs a job queue past a few hundred rows.
- Org picker UI — v1 reads `orgId`/`cycleId` from the URL.
