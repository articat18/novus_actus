# Energy Leaderboard Platform

Production-shaped backend + web demo for a university apartment-energy
competition. Residents compete on *reducing* their equal share of apartment
electricity, measured at fuse boxes and allocated across university-verified
occupants.

Originally a Postgres + Python (FastAPI/SQLAlchemy) service, this repository is
now a **Postgres + ERN** monorepo — **E**xpress, **R**eact, **N**ode, all
TypeScript — that runs in the browser and deploys to **Vercel**.

## Stack

| Concern | Tool |
|---|---|
| Language | TypeScript (strict) |
| API | Express, deployed as a Vercel serverless function |
| Web client | React + Vite (SPA) |
| Database | PostgreSQL via **Prisma** (schema + migrations + client) |
| Validation | zod |
| Dates / timezones | luxon (DST-correct competition weeks) |
| Tests | Vitest + Supertest |

## Layout

```
api/            Express app → Vercel serverless function
  index.ts        the function entry (imports the app)
  _src/           application code (underscore = not a Vercel endpoint)
    app.ts          createApp() factory (injectable deps)
    modules/        identity · university · competition · <stubs>
    ...
web/            React + Vite SPA (the browser client)
shared/         framework-free contract types (used by api + web)
prisma/         schema.prisma · migrations · seed.ts
vercel.json     build + routing for Vercel
.specs/         domain specification (stack-agnostic source of truth)
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins 22)
- A PostgreSQL 15+ database. For Vercel, use **Neon** or **Vercel Postgres**
  (both work with `DATABASE_URL`). Locally you can use Docker or any Postgres.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL and the two HMAC keys
```

Generate two random HMAC keys:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Database

Apply the schema and seed the demo tenant + roster:

```bash
npm run prisma:migrate   # prisma migrate deploy (applies prisma/migrations)
npm run db:seed          # deterministic demo data
```

`npm run prisma:push` (`prisma db push`) is a quick alternative that syncs the
schema without the hand-authored CHECK constraints. `npm run prisma:studio`
opens a data browser.

Seeded accounts:

| Email | Outcome |
|---|---|
| `active@demo.edu` | active enrolment + residence → can participate |
| `inactive@demo.edu` | inactive enrolment → roster-ineligible |
| `unknown@demo.edu` | not on the roster → not found |

## Run locally

```bash
npm run dev
```

- Web SPA: http://localhost:5173
- API: http://localhost:3001 (the SPA proxies `/api` here)

The demo has no real email integration, so a **development inbox** exposes the
verification code (`ENABLE_DEV_INBOX=true`) and the UI shows it. Turn it off in
any real deployment.

## Test

```bash
npm test        # unit tests (no database needed)
```

Integration tests (identity flow, verification API) self-skip unless a throwaway
database is provided:

```bash
TEST_DATABASE_URL="postgresql://user:pass@localhost:5432/energy_test" npm test
```

They push the schema and truncate between cases automatically.

## Deploy to Vercel

1. Import the repo. `vercel.json` already sets the build command
   (`npm run build`), output directory (`web/dist`), and routes `/api/*` to the
   serverless function.
2. Provision Vercel Postgres or Neon and set project **Environment Variables**:
   `DATABASE_URL`, `CHALLENGE_HMAC_KEY`, `SESSION_HMAC_KEY`. Leave
   `ENABLE_DEV_INBOX` unset (or `false`) in production.
3. Apply migrations to the production database once:
   `DATABASE_URL=<prod> npx prisma migrate deploy` (and `npm run db:seed` for the
   demo tenant).

`postinstall` runs `prisma generate`, and the client is built for Vercel's
runtime (`binaryTargets` includes `rhel-openssl-3.0.x`).

## Implemented vs. stubbed

**Implemented** (faithful ports of the working Python code, with tests):

- Passwordless university-email identity: OTP challenge, roster-gated
  activation, public usernames, HMAC sessions, role matrix.
- Deny-by-default authorization and tenant isolation with audit.
- University-local competition-window math (Monday 08:00 weeks, IANA timezones,
  DST 167h/169h weeks).
- Read-only roster verification.

**Stubbed** (typed placeholders under `api/_src/modules/`, matching the original
project's unbuilt lanes): topology, ingestion, usage, administration, archival,
and the leaderboard/scoring itself. See `.specs/features/energy-leaderboard-platform/`.

## Notable changes from the Python original

- **Two services merged into one app.** The pseudo-university is now an internal
  route group + roster tables in the same database, reached only through
  `UniversityVerificationGateway`. Set `UNIVERSITY_GATEWAY=http` to call a
  separate deployment instead.
- **JSON is camelCase** across the API and client (idiomatic TypeScript).
- **Prisma** replaces SQLAlchemy/Alembic; CHECK constraints and the
  `NULLS NOT DISTINCT` unique index live in the hand-authored init migration.
- SQLAlchemy's optimistic-lock `version` columns are retained as plain columns
  (not auto-incremented). Row `SELECT … FOR UPDATE` during verification is
  replaced by a Prisma interactive transaction.
