# Energy Leaderboard Platform

Production-shaped backend + web demo for a university apartment-energy
competition. Residents compete on *reducing* their equal share of apartment
electricity, measured at fuse boxes and allocated across university-verified
occupants.

Originally a Postgres + Python (FastAPI/SQLAlchemy) service, this repository is
now a **MongoDB + ERN** monorepo — **E**xpress, **R**eact, **N**ode, all
TypeScript — that runs in the browser and deploys to **Vercel**.

## Stack

| Concern | Tool |
|---|---|
| Language | TypeScript (strict) |
| API | Express, deployed as a Vercel serverless function |
| Web client | React + Vite (SPA) |
<<<<<<< HEAD
| Database | MongoDB via **Prisma** (schema + client; `db push`, no SQL migrations) |
=======
| Database | PostgreSQL via **Prisma** (schema + migrations + client) |
| Auth | Email + password (scrypt via `node:crypto`), HMAC session tokens |
>>>>>>> 407e5f4 (base added)
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
prisma/         schema.prisma · seed.ts
vercel.json     build + routing for Vercel
.specs/         domain specification (stack-agnostic source of truth)
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins 22)
- A MongoDB database running as a **replica set** (required for Prisma
  transactions, even a single-node replica set locally). For hosting, use
  **MongoDB Atlas** (works with `DATABASE_URL`). Locally you can use Docker —
  see `.env.example` for a one-line `docker run` + `rs.initiate()` setup.

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL and SESSION_HMAC_KEY
```

Generate a random HMAC key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Database

Apply the schema and seed the demo tenant + roster:

```bash
npm run prisma:push   # prisma db push — MongoDB has no SQL migrations
npm run db:seed       # deterministic demo data
```

`npm run prisma:studio` opens a data browser.

Note: the Postgres-era init migration enforced a few things at the database
layer (CHECK constraints requiring `normalized_*` columns to already be
lowercase, and a `NULLS NOT DISTINCT` unique index on `role_assignment`). Mongo
has no CHECK-constraint equivalent, so lowercasing relies entirely on the
application normalizing before writes. The `NULLS NOT DISTINCT` behavior,
however, is MongoDB's default for unique indexes (documents with a null/missing
field already collide), so `@@unique([accountId, role, universityId,
buildingId])` in `schema.prisma` reproduces it without extra configuration.

Seeded demo account (email + password sign-in):

| Email | Password | Notes |
|---|---|---|
| `demo@demo.edu` | `password123` | ready to sign in |

The roster behind the read-only verification endpoint
(`GET /api/v1/verification/residents`) also has `active@demo.edu`,
`inactive@demo.edu`, and `unknown@demo.edu`.

## Run locally

```bash
npm run dev
```

- Web SPA: http://localhost:5173 (`/` sign in, `/sign_up` register)
- API: http://localhost:3001 (the SPA proxies `/api` here)

Sign in with the seeded `demo@demo.edu` / `password123`, or create a new account
on the sign-up page — registration is open to any email address.

## Test

```bash
npm test        # unit tests (no database needed)
```

Integration tests (identity flow, verification API) self-skip unless a throwaway
database is provided:

```bash
TEST_DATABASE_URL="mongodb://localhost:27017/energy_test?replicaSet=rs0" npm test
```

They push the schema and clear every collection between cases automatically.

## Deploy to Vercel

1. Import the repo. `vercel.json` already sets the build command
   (`npm run build`), output directory (`web/dist`), and routes `/api/*` to the
   serverless function.
<<<<<<< HEAD
2. Provision a MongoDB Atlas cluster (replica set) and set project
   **Environment Variables**: `DATABASE_URL`, `CHALLENGE_HMAC_KEY`,
   `SESSION_HMAC_KEY`. In Atlas's Network Access tab, add the IPs that need to
   reach the cluster — Vercel's serverless functions use dynamic egress IPs, so
   most setups either use Atlas's "Allow access from anywhere" (`0.0.0.0/0`)
   entry or a static-IP add-on; if you use `0.0.0.0/0`, treat the database
   user's password as the only remaining line of defense. Leave
   `ENABLE_DEV_INBOX` unset (or `false`) in production.
3. Push the schema to the production database once:
   `DATABASE_URL=<prod> npx prisma db push` (and `npm run db:seed` for the
=======
2. Provision Vercel Postgres or Neon and set project **Environment Variables**:
   `DATABASE_URL` and `SESSION_HMAC_KEY`.
3. Apply migrations to the production database once:
   `DATABASE_URL=<prod> npx prisma migrate deploy` (and `npm run db:seed` for the
>>>>>>> 407e5f4 (base added)
   demo tenant).

`postinstall` runs `prisma generate`, and the client is built for Vercel's
runtime (`binaryTargets` includes `rhel-openssl-3.0.x`).

## Implemented vs. stubbed

**Implemented** (with tests):

- Email + password identity: open registration, sign-in, scrypt password
  hashing, HMAC session tokens, `GET /auth/me`, sign-out, and the role matrix.
- Deny-by-default authorization and tenant isolation with audit.
- University-local competition-window math (Monday 08:00 weeks, IANA timezones,
  DST 167h/169h weeks).
- Read-only roster verification.

**Stubbed** (typed placeholders under `api/_src/modules/`, matching the original
project's unbuilt lanes): topology, ingestion, usage, administration, archival,
and the leaderboard/scoring itself. See `.specs/features/energy-leaderboard-platform/`.

## Notable changes from the Python original

- **Email + password auth replaces the passwordless OTP flow.** The former
  university-email OTP challenge/verify, roster-gated activation, public
  usernames, and the demo "dev inbox" were removed. The web app is now a
  sign-in page at `/` and a sign-up page at `/sign_up`; registration is open to
  any email. The university roster stays in the database and remains queryable
  read-only through the verification module.
- **A move to MongoDB Atlas is planned.** The auth layer stores passwords as a
  portable scrypt string and avoids Postgres-specific features, to ease that
  migration.
- **Two services merged into one app.** The pseudo-university is now an internal
  route group + roster tables in the same database, reached only through
  `UniversityVerificationGateway`. Set `UNIVERSITY_GATEWAY=http` to call a
  separate deployment instead.
- **JSON is camelCase** across the API and client (idiomatic TypeScript).
- **Prisma + MongoDB** replaces SQLAlchemy/Alembic/Postgres; there are no SQL
  migrations (`prisma db push` syncs the schema), and DB-level CHECK
  constraints are gone (see the Database section above for what that means in
  practice).
- SQLAlchemy's optimistic-lock `version` columns are retained as plain columns
  (not auto-incremented). Row `SELECT … FOR UPDATE` during verification is
  replaced by a Prisma interactive transaction.
