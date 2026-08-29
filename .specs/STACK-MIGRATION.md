# Stack migration: Python → ERN

**Date:** 2026-08-29

The backend was migrated from **Postgres + Python** (FastAPI, SQLAlchemy,
Alembic, uv, pytest) to a **Postgres + ERN** monorepo (TypeScript, Express,
React, Node, Prisma, Vitest) that runs in the browser and deploys to Vercel.

## What this means for the docs in this folder

- `features/energy-leaderboard-platform/spec.md`, `context.md`, `design.md`, and
  `tasks.md` describe the **domain and requirements**, which are unchanged and
  still govern the work. Where `design.md`/`tasks.md` name Python packages,
  worktrees, or `uv`/`alembic`/`pytest` commands, read those as the *previous
  implementation*; the equivalents are now:
  - `src/platform_app/…` → `api/_src/…`
  - `src/pseudo_university_app/…` → `api/_src/modules/university/…` (merged in-process)
  - SQLAlchemy models + Alembic → `prisma/schema.prisma` + `prisma/migrations`
  - `uv run pytest` → `npm test` (Vitest)
  - service factories → `createApp()` in `api/_src/app.ts`
- `STATE.md` and `HANDOFF.md` are **historical** records of the Python execution
  (branches, worktrees, T00x commits). They are retained for provenance but no
  longer describe the working tree.

## Ported vs. stubbed

Faithfully ported (with tests): identity/auth, authorization, tenant isolation,
competition windows, roster verification. Still stubbed (as before): topology,
ingestion, usage, administration, archival, and leaderboard scoring.

See the repository `README.md` for the current architecture, commands, and the
full list of deviations (service merge, camelCase JSON, Prisma constraints,
optimistic-lock columns).
