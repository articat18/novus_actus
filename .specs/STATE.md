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
- **Completed tasks:** T001 — service foundation; T002 — tenant persistence; T003 — isolated pseudo-university service.
- **Commits:** `build(platform): establish reproducible service foundation`; `feat(identity): add tenant-aware persistence foundation`; `feat(university): add isolated roster verification service` (created with this state update).
- **T003 gate evidence:** Independent pseudo-university migration upgrade/downgrade/upgrade and `alembic check` passed; `ruff format --check` passed for 48 files; `ruff check` passed; `mypy src tests` passed for 38 source files; cumulative `pytest` passed 16 tests, including 7 pseudo-university API/contract/boundary tests.
- **Implementation scope:** Separate roster database metadata and migration lineage; effective enrolment/residence models; deterministic seed interface; GET-only verification API; platform-owned gateway contract and HTTP adapter; enforced no-import persistence boundary.
- **Next step:** Execute T004 using the tenant persistence and roster-verification contract.
