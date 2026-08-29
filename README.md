# Energy Leaderboard Platform

Production-shaped backend + web demo for a university apartment-energy
competition. Residents compete on *reducing* their equal share of apartment
electricity, measured at fuse boxes and allocated across university-verified
occupants.

Originally a Postgres + Python (FastAPI/SQLAlchemy) service, this repository is
now a **MongoDB + ERN** monorepo — **E**xpress, **R**eact, **N**ode, all
TypeScript — that runs in the browser and deploys to **Vercel**.

> **Migration in progress.** The data layer has just been rotated from
> Postgres/Prisma to MongoDB (official `mongodb` driver). The connection is
> wired via `MONGODB_URI`; **collections and schemas are not defined yet**, so
> the persistence-backed endpoints (auth, roster verification) validate their
> input and then return `501 Not Implemented`. See _Current status_ below.

## Stack

| Concern | Tool |
|---|---|
| Language | TypeScript (strict) |
| API | Express, deployed as a Vercel serverless function |
| Web client | React + Vite (SPA) |
| Database | MongoDB via the official **`mongodb`** driver |
| Validation | zod |
| Dates / timezones | luxon (DST-correct competition weeks) |
| Tests | Vitest + Supertest |

## Layout

```
api/            Express app → Vercel serverless function
  index.ts        the function entry (imports the app)
  _src/           application code (underscore = not a Vercel endpoint)
    app.ts          createApp() factory (injectable deps)
    db.ts           MongoDB connection (lazy, pooled, reads MONGODB_URI)
    config.ts       env validation (MONGODB_URI, SESSION_HMAC_KEY)
    modules/        identity · university · competition · <stubs>
web/            React + Vite SPA (the browser client)
shared/         framework-free contract types (used by api + web)
vercel.json     build + routing for Vercel
.specs/         domain specification (stack-agnostic source of truth)
```

## Prerequisites

- Node.js 20+ (`.nvmrc` pins 22)
- A MongoDB database — **MongoDB Atlas** (recommended) or a local `mongod`.
  Include the database name in the connection string (e.g. `.../energy`).

## Setup

```bash
npm install
cp .env.example .env   # then edit MONGODB_URI and SESSION_HMAC_KEY
```

Generate a random HMAC key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Database

There are no migrations or seeds — the app connects to MongoDB lazily on first
use and reuses the connection across warm serverless invocations. Set
`MONGODB_URI` (the database name is taken from the URI) and start the app;
`GET /api/health/ready` pings the database and returns `200`/`503`.

Collections and their schemas will be added in a follow-up change (this one only
establishes the connection).

## Current status

Working now: the MongoDB connection + health checks, config validation, the
competition-window math, the authorization matrix, and password/session crypto
helpers — plus the web SPA (a sign-in page at `/` and a sign-up page at
`/sign_up`).

Stubbed until the schema lands (returns `501`): `POST /api/v1/auth/sign-up`,
`/auth/sign-in`, `GET /auth/me`, `POST /auth/sign-out`, and
`GET /api/v1/verification/residents`. The sign-in / sign-up pages render and
validate input, but submitting will surface the "not implemented yet" message
until the identity collections are defined.

## Run locally

```bash
npm run dev
```

- Web SPA: http://localhost:5173 (`/` sign in, `/sign_up` register)
- API: http://localhost:3001 (the SPA proxies `/api` here)

## Test

```bash
npm test        # unit tests (no database needed)
```

The suite is DB-free (window math, authorization, config, crypto, email
normalization). Data-backed integration tests return once the MongoDB
collections exist.

## Deploy to Vercel

1. Import the repo. `vercel.json` already sets the build command
   (`npm run build`), output directory (`web/dist`), and routes `/api/*` to the
   serverless function.
2. Provision a MongoDB Atlas cluster and set project **Environment Variables**:
   `MONGODB_URI` and `SESSION_HMAC_KEY`. In Atlas → Network Access, allow the
   IPs that need to reach the cluster (Vercel functions use dynamic egress IPs,
   so most setups use `0.0.0.0/0` or a static-IP add-on; with `0.0.0.0/0` the
   database user's password is the remaining line of defense).

There is no `prisma generate`/`migrate` step anymore, and no `postinstall`.

## Implemented vs. stubbed

**Implemented** (with tests, no database required):

- University-local competition-window math (Monday 08:00 weeks, IANA timezones,
  DST 167h/169h weeks).
- Deny-by-default authorization matrix and email normalization.
- Password hashing (scrypt via `node:crypto`) and session-token digests.
- MongoDB connection + liveness ping.

**Stubbed** (return `501`, pending the MongoDB schema): email + password
identity (sign-up / sign-in / me / sign-out) and read-only roster verification.
Also still stubbed from the original project: topology, ingestion, usage,
administration, archival, and the leaderboard/scoring itself.
See `.specs/features/energy-leaderboard-platform/`.

## Notable changes from the Python original

- **Data layer is MongoDB via the official `mongodb` driver.** Postgres, Prisma,
  the SQL migrations, and the seed were removed. `MONGODB_URI` drives the
  connection; `api/_src/db.ts` holds a lazy, pooled client. Schemas/collections
  are defined in a later change.
- **Email + password auth** (replacing the earlier passwordless OTP flow) — a
  sign-in page at `/` and a sign-up page at `/sign_up`, open registration, no
  2FA/OAuth. The service is currently stubbed pending the MongoDB schema.
- **JSON is camelCase** across the API and client (idiomatic TypeScript).
