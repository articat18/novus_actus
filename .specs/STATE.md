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
- **Current phase:** Execute, Wave 0.
- **Completed task:** T001 — reproducible Python service foundation.
- **Commit:** `build(platform): establish reproducible service foundation` (atomic commit created with this state update).
- **Gate evidence:** `uv run ruff format --check .` passed for 32 files; `uv run ruff check .` passed; `uv run mypy src tests` passed for 24 source files; `uv run pytest` passed 5 tests.
- **Migration evidence:** Both Alembic entry points completed an offline `upgrade head --sql` smoke run.
- **Implementation scope:** Package/configuration foundations, module-boundary skeletons, independent migration entry points, dependency lock, and smoke tests only; no feature behavior was introduced.
- **Next step:** Tech Lead integrates T001 into `conrad`, runs the cumulative gate, then releases T002, T003, T005, and T014 according to dependency order.
