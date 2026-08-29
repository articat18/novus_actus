# Energy Leaderboard Platform: Confirmed Context

## Product intent

Build a production-shaped backend demo for a potentially sellable university energy competition. The backend receives electricity measurements from apartment fuse boxes, attributes an equal per-person share to verified residents, and publishes building-scoped improvement leaderboards to iOS, Android, and web clients through APIs.

The demo includes the SQL database, sensor-ingestion API, application and administration APIs, a pseudo-university database and verification API, synthetic sensors and semester data, automated tests, OpenAPI documentation, Docker Compose startup, and a minimal browser demonstration. Production mobile clients and physical sensor firmware are outside scope.

## Confirmed decisions

### Measurement topology

- A university contains dorm buildings; buildings contain apartments; apartments contain one or more rooms.
- A fuse box serves exactly one apartment at a time, and an apartment may have multiple fuse boxes.
- A meter is assigned to a fuse box with effective dates. Replacing a meter does not reset apartment or participant history.
- Sensors measure genuine hourly energy in kWh. They transmit 24 hourly values in a daily batch.
- A canonical raw reading contains `meter_id`, `hour_start_utc`, `energy_kwh`, and `received_at`.
- `(meter_id, hour_start_utc)` is the idempotency key. A separate event ID and interval end are unnecessary.
- UTC is used for storage; each university owns an IANA timezone for local competition boundaries.

### Occupancy and attribution

- The pseudo-university system is authoritative for effective-dated residence assignments.
- Residence changes take effect at an 08:00 local-time accounting boundary.
- The system calculates and stores fuse-box and apartment hourly usage records.
- `occupant_count` is derived from active university residence records, never supplied by a sensor.
- Apartment hourly kWh is the sum of all expected active fuse boxes for the apartment.
- Each active apartment occupant receives an equal share: `apartment_kwh / occupant_count`.
- The public product language is "your equal share of apartment electricity usage," not individually measured usage.
- When occupant count is zero, consumption remains stored as unallocated energy; per-person usage is null.
- When any expected fuse-box reading is missing, the apartment-hour is incomplete.

### Competition

- Leaderboards are scoped to a dorm building.
- A competition week runs Monday 08:00 to the following Monday 08:00 in the university's local timezone.
- At 08:00 each day, the provisional board compares the current Monday-to-cutoff period with the matching elapsed portion of the immediately preceding week.
- Daily calculation must finish by 08:05. On failure, the last successful snapshot remains available and is marked stale.
- Ranking uses percentage reduction in average daily attributed kWh.
- Absolute attributed kWh reduction and then lowest current attributed kWh break non-exact ties. Exact ties share a rank.
- A participant needs a positive baseline and at least 95% complete apartment-hour coverage in both comparison windows.
- A participant whose apartment occupancy changes across the compared windows is ineligible for that competition period.
- A participant who changes apartment preserves personal and finalized history but must complete a new baseline week before competing, even within the same building.
- All eligible occupants of the same apartment receive the same usage share, improvement percentage, and rank.
- A weekly winner must have a positive improvement. If nobody improves, there is no winner.
- The week closes Monday at 08:00 and remains pending for 24 hours. It finalizes Tuesday at 08:00.
- Finalized historical leaderboards retain the captured username. A mover disappears from the old active board but remains in its finalized history.

### Identity, privacy, and tenancy

- A participant must verify a university email address with a one-time code.
- The platform verifies active enrolment and effective-dated residence by calling a read-only university API.
- Universities, buildings, apartments, rooms, fuse boxes, and residence assignments are not self-asserted by participants.
- Only a participant's public username appears on leaderboards. Email and residence details remain private.
- Usernames are unique within a university, moderated, and captured on finalization so later renames do not rewrite history.
- Roles are participant, building administrator, and platform administrator.
- Each university is an isolated tenant. Cross-tenant operation is limited to platform administrators and is audited.
- Each meter uses an independent revocable credential; resident credentials never authorize ingestion.

### Integrity and lifecycle

- Impossible readings are rejected. Suspicious readings are quarantined and excluded until approved.
- Accepted readings are not silently overwritten. Corrections record previous value, replacement value, reason, actor, and timestamp.
- Corrections may recompute provisional results but never finalized results.
- Late readings may be stored after finalization but do not change the finalized competition.
- Operational data covers one 13-week semester. Completed semester data is archived through an object-storage interface after verification.
- The demo uses local S3-compatible storage; the production adapter may target managed object storage.
- Account deletion anonymizes historical leaderboard identity without corrupting finalized ranks.

## Demo defaults awaiting spec approval

- Two universities, each with three buildings, three floors per building, ten rooms per floor, and one or two residents per room.
- `Asia/Singapore` is the seed timezone, while the implementation supports any IANA timezone.
- Shared ranks use standard competition ranking (`1, 1, 3`).
- PostgreSQL, FastAPI, SQLAlchemy, Alembic, pytest, Docker Compose, and OpenAPI are the proposed stack.

