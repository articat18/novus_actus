# Project State

## Decisions

- **AD-001 — Competition boundary:** Leaderboards are building-scoped and use university-local Monday 08:00 competition weeks.
- **AD-002 — Measurement boundary:** Electricity is measured at apartment fuse boxes and cannot be attributed to individual behavior.
- **AD-003 — Transparent allocation:** Apartment energy is split equally across university-verified active occupants and described as an equal share.
- **AD-004 — Ingestion contract:** Sensors upload genuine hourly kWh values in a daily batch; `(meter_id, hour_start_utc)` supplies idempotency.
- **AD-005 — Historical occupancy:** Effective-dated residence and calculated occupant-count snapshots determine historical allocation.
- **AD-006 — Improvement score:** Percentage reduction in average daily attributed kWh determines rank, subject to coverage, baseline, and stable-occupancy eligibility.
- **AD-007 — Result lifecycle:** Daily boards are provisional; weekly results close Monday 08:00 and finalize after a 24-hour correction period.
- **AD-008 — Privacy:** Only captured usernames are public; university email and residence are private.
- **AD-009 — University authority:** University email, enrolment, and residence are verified through a separate read-only integration.
- **AD-010 — Demo shape:** The backend is production-shaped, multi-tenant, containerized, and includes pseudo-university, sensor, email, and archive adapters.
- **AD-011 — Retention:** Operational competition data covers a 13-week semester and is archived through a verified object-storage export.

## Handoff

- **Branch:** `agent/e1-foundation`, derived from `conrad` at `6d97eee`.
- **Feature:** `energy-leaderboard-platform`
- **Current phase:** Execute, Wave 1.
- **Completed tasks:** T001 — service foundation; T002 — tenant persistence; T003 — isolated university service; T004 — passwordless resident identity and roles.
- **Commits:** `build(platform): establish reproducible service foundation`; `feat(identity): add tenant-aware persistence foundation`; `feat(university): add isolated roster verification service`; `feat(identity): verify university residents and issue scoped access` (created with this state update).
- **T004 gate evidence:** Platform migrations upgraded/downgraded/upgraded with `alembic check` reporting no drift; dependency lock, format, lint, and strict type gates passed; cumulative `pytest` passed 30 tests, including 10 identity API/PostgreSQL tests and 4 deny-by-default role-matrix tests.
- **Implementation scope:** HMAC-protected expiring single-use challenges and sessions; request/attempt limits; university-domain and roster activation; private effective verified-residence history; university-scoped usernames; participant grants; tenant/building/platform authorization primitives; privacy-safe API responses and secret-free logs.
- **Next step:** Tech Lead integrates the three sequential task commits into `conrad` and releases downstream T005, T010, and T018 dependencies as their prerequisite lanes complete.
