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

- **Branch:** `conrad`
- **Feature:** `energy-leaderboard-platform`
- **Current phase:** Specify, Design, and Tasks proposed; awaiting user approval before Execute.
- **Confirmed context:** `.specs/features/energy-leaderboard-platform/context.md`
- **Proposed specification:** `.specs/features/energy-leaderboard-platform/spec.md`
- **Proposed architecture:** `.specs/features/energy-leaderboard-platform/design.md`
- **Proposed task plan:** `.specs/features/energy-leaderboard-platform/tasks.md`
- **Next step:** Obtain explicit approval of the four specification assumptions and execution plan before implementation.
- **Implementation status:** No feature code or migrations have been written.
