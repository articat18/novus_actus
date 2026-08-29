# Energy Leaderboard Platform Specification

**Status:** Proposed  
**Scope:** Complex, greenfield, multi-service backend demo  
**Source of truth:** Confirmed decisions in `context.md`

## Problem

University residents need a privacy-preserving way to compare reductions in their equal share of apartment electricity consumption. A sensor measures electricity at one or more apartment fuse boxes, not at an individual resident. The system must therefore preserve measurement integrity, resolve occupancy from university records, calculate transparent per-person allocations, and prevent incomplete or corrected data from producing false winners.

## Goals

1. Ingest idempotent hourly kWh readings uploaded in daily batches.
2. Calculate fuse-box, apartment, and per-person hourly consumption with historical occupancy snapshots.
3. Publish daily provisional and finalized weekly building leaderboards based on improvement.
4. Verify university identity and residence without exposing personal data publicly.
5. Demonstrate multi-university tenancy, administration, auditability, anomaly handling, and semester archival.

## Non-goals

- Measuring the electricity consumption of an individual person directly.
- Attributing apartment consumption to a particular room without room-level submeters.
- Building production iOS, Android, or web clients.
- Implementing physical sensor firmware or a production university integration.
- Allowing application clients to connect directly to PostgreSQL.

## Domain definitions

- **University:** Tenant and owner of timezone, email domains, buildings, and policies.
- **Building:** Dormitory competition boundary.
- **Apartment:** Occupancy and energy-allocation boundary containing one or more rooms.
- **Fuse box:** Electrical measurement point assigned to exactly one apartment at a time.
- **Meter:** Replaceable sensor identity assigned to a fuse box for an effective interval.
- **Hourly reading:** Energy in kWh for the UTC hour beginning at `hour_start_utc`.
- **Active occupant:** Verified resident whose effective residence includes the local accounting hour.
- **Per-person share:** Apartment hourly kWh divided equally by active apartment occupants.
- **Complete apartment-hour:** An hour with accepted readings from every expected active fuse box.
- **Provisional board:** Recomputable daily snapshot before weekly finalization.
- **Finalized board:** Immutable competition result after the correction window.

## Functional requirements and acceptance criteria

### Tenant, identity, and residence

**REQ-ID-001 — University email authentication**  
WHEN a user requests access with an email belonging to a configured university domain, THE SYSTEM SHALL issue a single-use, expiring one-time verification code without revealing whether an unrelated account exists.

- **AC-ID-001A:** WHEN a valid unused code is presented before expiry, THE SYSTEM SHALL verify the email exactly once; WHEN a code is expired, reused, or incorrect, THE SYSTEM SHALL reject it.
- **AC-ID-001B:** WHEN an email uses a non-university domain, THE SYSTEM SHALL prevent participant-account creation.

**REQ-ID-002 — University roster verification**  
WHEN an email is verified, THE SYSTEM SHALL obtain the user's active enrolment and residence from the configured university verification API before activating participation.

- **AC-ID-002A:** WHEN the roster returns an active match, THE SYSTEM SHALL create or update the private university identity and effective residence.
- **AC-ID-002B:** WHEN the roster returns no match, inactive enrolment, or no residence, THE SYSTEM SHALL prevent leaderboard participation and SHALL NOT accept a self-asserted room.

**REQ-ID-003 — Public identity**  
WHILE serving any participant-facing leaderboard, THE SYSTEM SHALL expose only the captured public username and competition data, never email, room, apartment, or private university identifiers.

- **AC-ID-003A:** WHEN a username is created or changed, THE SYSTEM SHALL enforce uniqueness within the university.
- **AC-ID-003B:** WHEN a profile username changes, THE SYSTEM SHALL retain the username captured by every finalized entry.
- **AC-ID-003C:** WHEN an account is deleted, THE SYSTEM SHALL replace its public historical username with an anonymous label without changing ranks.

**REQ-TEN-001 — Tenant isolation**  
WHILE processing a tenant-scoped request or job, THE SYSTEM SHALL restrict reads and writes to the authenticated university unless an audited platform-administrator operation explicitly selects another tenant.

- **AC-TEN-001A:** WHEN participant or building-administrator credentials address another university's record, THE SYSTEM SHALL deny access, including when identifiers are guessed.
- **AC-TEN-001B:** WHEN a platform administrator performs a cross-tenant operation, THE SYSTEM SHALL create an audit event.

**REQ-RES-001 — Effective residence**  
WHEN university residence data changes, THE SYSTEM SHALL preserve effective-dated membership and apply leaderboard-accounting changes at the next local 08:00 boundary.

- **AC-RES-001A:** WHEN historical allocation is calculated, THE SYSTEM SHALL use the membership active for its accounting hour rather than the user's current residence.
- **AC-RES-001B:** WHEN a participant changes apartment, THE SYSTEM SHALL start a new baseline, remove the participant from the prior active board, and preserve finalized history.

### Physical topology and ingestion

**REQ-TOP-001 — Apartment measurement topology**  
THE SYSTEM SHALL model buildings, apartments, rooms, fuse boxes, meters, effective fuse-box-to-apartment assignments, and effective meter-to-fuse-box assignments.

- **AC-TOP-001A:** THE SYSTEM SHALL permit an apartment to contain multiple rooms and multiple fuse boxes.
- **AC-TOP-001B:** FOR any instant, THE SYSTEM SHALL assign a fuse box to at most one apartment and a meter to at most one fuse box.
- **AC-TOP-001C:** WHEN a meter is replaced, THE SYSTEM SHALL preserve fuse-box, apartment, and participant history.

**REQ-ING-001 — Authenticated daily batch ingestion**  
WHEN an active meter submits a batch, THE SYSTEM SHALL authenticate its revocable credential and accept hourly records containing `meter_id`, `hour_start_utc`, and non-negative `energy_kwh`, recording server-controlled `received_at`.

- **AC-ING-001A:** WHEN a valid batch contains no more than 24 distinct hourly records, THE SYSTEM SHALL accept each record that passes validation.
- **AC-ING-001B:** WHEN a resident credential or revoked meter credential submits readings, THE SYSTEM SHALL deny ingestion.
- **AC-ING-001C:** WHEN a reading is persisted, THE SYSTEM SHALL store its timestamp in UTC at an exact hour boundary.

**REQ-ING-002 — Idempotency and correction detection**  
WHEN a reading is submitted for an existing `(meter_id, hour_start_utc)`, THE SYSTEM SHALL avoid duplicate energy and distinguish an identical retry from a changed value.

- **AC-ING-002A:** WHEN an identical meter-hour is retried, THE SYSTEM SHALL return the existing outcome without duplicating consumption.
- **AC-ING-002B:** WHEN an existing meter-hour is submitted with a different kWh value, THE SYSTEM SHALL create a reviewable correction proposal or audit record and SHALL NOT silently replace the accepted value.

**REQ-ING-003 — Reading validation and quarantine**  
IF a reading is structurally impossible, THE SYSTEM SHALL reject it; IF it exceeds a configured apartment or building threshold, THE SYSTEM SHALL quarantine it from aggregation pending administrator review.

- **AC-ING-003A:** WHEN a reading is negative, non-finite, malformed, or impermissibly future-dated, THE SYSTEM SHALL reject it.
- **AC-ING-003B:** WHILE a reading is quarantined, THE SYSTEM SHALL keep it inspectable and SHALL exclude it from completeness and scoring.
- **AC-ING-003C:** WHEN an administrator approves or rejects a quarantined reading, THE SYSTEM SHALL create an immutable audit event.

### Hourly calculation and allocation

**REQ-CALC-001 — Fuse-box hourly usage**  
WHEN an accepted hourly meter reading resolves to an active fuse-box assignment, THE SYSTEM SHALL calculate a fuse-box hourly usage record containing the fuse box, UTC hour, kWh, apartment occupant-count snapshot, per-person kWh when defined, and provenance.

- **AC-CALC-001A:** WHEN occupant count is calculated, THE SYSTEM SHALL derive it from effective university residence and SHALL ignore any sensor-supplied occupancy value.
- **AC-CALC-001B:** WHEN occupant count is zero, THE SYSTEM SHALL set per-person kWh to null and mark the kWh unallocated.

**REQ-CALC-002 — Apartment hourly usage**  
WHEN an apartment-hour is calculated, THE SYSTEM SHALL sum accepted usage from all expected active fuse boxes and store total kWh, occupant count, per-person kWh, occupancy snapshot time, expected/received fuse-box counts, and completeness.

- **AC-CALC-002A:** WHEN occupant count is greater than zero, THE SYSTEM SHALL calculate `per_person_kwh = total_energy_kwh / occupant_count`; OTHERWISE THE SYSTEM SHALL leave it null.
- **AC-CALC-002B:** WHEN any expected active fuse box is missing, THE SYSTEM SHALL mark the apartment-hour incomplete.
- **AC-CALC-002C:** WHEN an apartment has zero occupants, THE SYSTEM SHALL preserve total kWh as unallocated and exclude the hour from participant allocation.

**REQ-CALC-003 — Participant hourly allocation**  
WHEN an apartment-hour is complete and has active occupants, THE SYSTEM SHALL store the same calculated per-person kWh allocation for every active occupant with links to the apartment usage and occupancy snapshot.

- **AC-CALC-003A:** WHEN participant allocations are stored, THE SYSTEM SHALL ensure their sum equals apartment kWh within configured decimal tolerance.
- **AC-CALC-003B:** WHEN an apartment-hour is allocated, THE SYSTEM SHALL give every active occupant an equal allocation.

### Competition and leaderboard

**REQ-COMP-001 — Competition windows**  
THE SYSTEM SHALL define a university-local competition week from Monday 08:00 inclusive to the following Monday 08:00 exclusive, converting boundaries through the university's IANA timezone.

- **AC-COMP-001A:** WHEN a Thursday board is calculated, THE SYSTEM SHALL compare Monday 08:00–Thursday 08:00 with the same elapsed portion of the immediately preceding week.
- **AC-COMP-001B:** WHEN a full weekly board is calculated, THE SYSTEM SHALL compare two consecutive seven-day windows.

**REQ-COMP-002 — Improvement score**  
WHEN both windows are eligible, THE SYSTEM SHALL calculate average daily attributed kWh and improvement percentage as `(previous_average - current_average) / previous_average * 100`.

- **AC-COMP-002A:** WHEN the previous average is not positive, THE SYSTEM SHALL mark the participant `insufficient-baseline` and leave the participant unranked.
- **AC-COMP-002B:** WHEN a score is returned, THE SYSTEM SHALL expose previous/current average daily kWh, percentage improvement, and absolute attributed kWh reduction.

**REQ-COMP-003 — Eligibility**  
WHILE calculating a board, THE SYSTEM SHALL rank only participants with at least 95% complete apartment-hour coverage in both windows, a complete baseline after the latest apartment move, and unchanged apartment occupancy across the compared windows.

- **AC-COMP-003A:** WHEN expected fuse-box data is missing, THE SYSTEM SHALL reduce coverage and SHALL NOT treat the missing value as zero usage.
- **AC-COMP-003B:** WHEN a participant is ineligible, THE SYSTEM SHALL keep the participant viewable with a machine-readable reason and no rank.

**REQ-COMP-004 — Building ranking**  
WHEN an eligible building board is ranked, THE SYSTEM SHALL order by improvement percentage descending, then absolute kWh reduction descending, then current attributed kWh ascending; exact ties receive the same standard-competition rank.

- **AC-COMP-004A:** WHEN two leaders have exactly equal ranking keys, THE SYSTEM SHALL assign both rank 1 and assign the next distinct score rank 3.
- **AC-COMP-004B:** WHEN the leading improvement percentage is not greater than zero, THE SYSTEM SHALL declare no winner.
- **AC-COMP-004C:** WHEN occupants share the same unchanged apartment and are eligible, THE SYSTEM SHALL assign them identical scores and shared ranks.

**REQ-COMP-005 — Daily provisional board**  
WHEN local time reaches 08:00 each day, THE SYSTEM SHALL calculate a building-scoped cumulative provisional board and make the successful snapshot available by 08:05.

- **AC-COMP-005A:** WHEN calculation fails, THE SYSTEM SHALL continue serving the last successful snapshot marked `stale` with its actual calculation time.
- **AC-COMP-005B:** WHEN recomputation succeeds, THE SYSTEM SHALL produce an auditable immutable snapshot version.

**REQ-COMP-006 — Weekly finalization**  
WHEN a competition week closes Monday at 08:00, THE SYSTEM SHALL mark the result pending, accept competition-affecting corrections for 24 hours, and finalize it Tuesday at 08:00.

- **AC-COMP-006A:** WHILE a snapshot is finalized, THE SYSTEM SHALL reject attempts to recompute or edit it.
- **AC-COMP-006B:** WHEN readings arrive after finalization, THE SYSTEM SHALL permit storage but SHALL NOT change the finalized result.
- **AC-COMP-006C:** WHEN a participant moves, THE SYSTEM SHALL keep historical entries associated with their original building and captured username.

### APIs, administration, and lifecycle

**REQ-API-001 — Client API**  
THE SYSTEM SHALL provide authenticated APIs for profile and residence status, hourly/daily/weekly personal allocations, current building leaderboard, and historical finalized building leaderboards.

- **AC-API-001A:** WHEN usage is returned, THE SYSTEM SHALL identify it as an equal apartment share and include apartment total, occupant count, and per-person share where authorized.
- **AC-API-001B:** WHEN API contracts are published through OpenAPI, THE SYSTEM SHALL contain no direct database credentials.

**REQ-ADM-001 — Administration**  
THE SYSTEM SHALL provide role-restricted APIs for university/building topology, meter assignments, occupancy synchronization, anomaly review, and audited corrections.

- **AC-ADM-001A:** WHEN a building administrator operates on a resource, THE SYSTEM SHALL restrict the operation to an assigned building.
- **AC-ADM-001B:** WHEN a correction, anomaly decision, assignment change, username moderation action, or cross-tenant action occurs, THE SYSTEM SHALL record actor, time, reason, and before/after state.

**REQ-UNI-001 — Pseudo-university integration**  
THE DEMO SYSTEM SHALL run a separately deployed pseudo-university API and database that exposes read-only verification of university email, enrolment, and effective residence.

- **AC-UNI-001A:** WHEN the leaderboard service accesses university data, THE DEMO SYSTEM SHALL use only the university API interface.
- **AC-UNI-001B:** WHEN demo data is seeded, THE DEMO SYSTEM SHALL create two universities, three buildings per university, representative apartments/rooms, and approximately 270 residents with moves and shared occupancy cases.

**REQ-ARC-001 — Semester archival**  
WHEN a 13-week semester is closed, THE SYSTEM SHALL export hourly readings, calculated usage, audit provenance, and leaderboard snapshots through an object-storage interface and verify the archive before removing eligible operational records.

- **AC-ARC-001A:** WHEN the demo archives a semester, THE DEMO SYSTEM SHALL target local S3-compatible storage.
- **AC-ARC-001B:** WHEN an archive is exported, THE SYSTEM SHALL record object checksums, record counts, tenant, semester, schema version, export time, and verification status in a manifest.
- **AC-ARC-001C:** WHEN archive verification fails, THE SYSTEM SHALL leave operational records intact and report the failure.

**REQ-OPS-001 — Health and observability**  
THE SYSTEM SHALL expose liveness/readiness state and emit structured logs and metrics for ingestion, calculation duration, missing coverage, quarantines, stale boards, university API failures, and archival jobs.

- **AC-OPS-001A:** WHEN required database migrations or critical dependencies are unavailable, THE SYSTEM SHALL report not ready.
- **AC-OPS-001B:** WHEN a board misses its 08:05 deadline, THE SYSTEM SHALL produce an administrator-visible alert signal.

## Quality requirements

- **REQ-NFR-001 — Precision:** WHILE calculating or persisting energy and scores, THE SYSTEM SHALL use fixed-precision decimal arithmetic and SHALL NOT persist floating-point competition values.
- **REQ-NFR-002 — Security:** WHILE operating, THE SYSTEM SHALL obtain secrets from the environment, protect stored credentials appropriately, default authorization to deny, and exclude sensitive data from logs.
- **REQ-NFR-003 — Reproducibility:** WHEN the documented Docker Compose command runs in a clean environment, THE DEMO SYSTEM SHALL start PostgreSQL, the platform API/worker, pseudo-university service, development inbox, and local object storage with deterministic seed data.
- **REQ-NFR-004 — Testability:** WHEN the acceptance gate runs, THE SYSTEM SHALL verify timezone boundaries, idempotency, tenant isolation, allocation conservation, incomplete data, moves, ties, finalization, and archival failure safety with tests derived from this specification.
- **REQ-NFR-005 — Portability:** WHERE sensor, email, university verification, scheduler, or archive integration is required, THE SYSTEM SHALL call an explicit interface with a replaceable demo adapter.

## Assumptions requiring approval with this specification

1. Standard competition ranking is used for exact ties (`1, 1, 3`).
2. The demo seeds `Asia/Singapore`, while competition logic accepts any IANA timezone.
3. A participant may appear in rankings with zero or negative improvement, but no winner is declared unless the leading score is positive.
4. Late readings remain ingestible after weekly finalization for historical completeness but cannot alter finalized competition results.

## Requirement traceability target

Every implementation task must list the requirement IDs it satisfies, tests derived from the associated acceptance criteria, and an executable gate. Final validation must cite file-and-line evidence for every acceptance criterion and must be performed by an author-independent verifier.
