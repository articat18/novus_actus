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

- **Branch:** `conrad`.
- **Feature:** `energy-leaderboard-platform`
- **Current phase:** Paused during Execute, Wave 1, at user request.
- **Completed tasks:** T001 — service foundation; T002 — tenant persistence; T003 — isolated university service; T004 — passwordless resident identity and roles; T014 — university-local cumulative competition windows.
- **Commits:** `build(platform): establish reproducible service foundation`; `feat(identity): add tenant-aware persistence foundation`; `feat(university): add isolated roster verification service`; `feat(identity): verify university residents and issue scoped access`; `feat(competition): define local cumulative comparison windows`.
- **T004 gate evidence:** Platform migrations upgraded/downgraded/upgraded with `alembic check` reporting no drift; dependency lock, format, lint, and strict type gates passed; cumulative `pytest` passed 30 tests, including 10 identity API/PostgreSQL tests and 4 deny-by-default role-matrix tests.
- **T014 gate evidence:** Formatting, lint, and strict type gates passed; cumulative `pytest` passed 19 tests on its branch, including 14 deterministic competition-window tests.
- **Window evidence:** Tests cover Monday and Thursday cutoffs, inclusive starts/exclusive ends, three IANA timezones including a half-hour offset, 167-hour DST-gap and 169-hour DST-fold weeks, and year/semester boundaries without database access.
- **Pause state:** All agents interrupted or complete; all tests paused; `novus-actus-test-postgres` stopped without deletion; Engineer 2 uncommitted T008 work preserved.
- **Detailed handoff:** `.specs/HANDOFF.md` is the source of truth for worktrees, unintegrated commits, open gate findings, and resume order.
- **Next step:** Do not run tests or resume implementation until the user explicitly requests it. Resume Engineer 2 in place with T008.
