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

- **Branch:** `agent/e2-ingestion`, derived from `conrad` at `af7dbda`.
- **Feature:** `energy-leaderboard-platform`
- **Current phase:** Execute, Wave 1.
- **Completed tasks:** T001 — reproducible Python service foundation; T002 — tenant-aware persistence foundation; T005 — dorm topology and effective assignments; T006 — revocable meter credentials; FIX-T006-001 — durable rejected meter attempts; T007 — idempotent hourly batch ingestion; T008 — immutable changed-duplicate corrections.
- **Commits:** `build(platform): establish reproducible service foundation`; `feat(identity): add tenant-aware persistence foundation` (created with this state update).
- **T008 gate evidence:** Correction suite passes 2 PostgreSQL tests covering identical no-op retries, changed-value proposals, before/after audit provenance, concurrent proposal deduplication, and accepted-reading immutability.
- **Implementation scope:** Authenticated ingestion persists batch provenance and unique meter-hour readings with per-record accepted, duplicate, changed-duplicate, or rejected outcomes.
- **Next step:** Execute T009 for configurable anomaly quarantine and audited decisions.
