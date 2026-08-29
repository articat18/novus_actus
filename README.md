# Energy Leaderboard Platform

Production-shaped backend demo for a university apartment-energy competition. The
repository contains two independently configurable Python services:

- `platform_app`: platform API, ingestion, calculation, competition, and worker
  module boundaries.
- `pseudo_university_app`: the isolated read-only university verification
  service boundary.

Feature behavior is implemented incrementally from the approved specification
under `.specs/features/energy-leaderboard-platform/`.

## Prerequisites

- Python 3.14.6
- [uv](https://docs.astral.sh/uv/) 0.12 or newer

## Install

Create the locked development environment from a clean checkout:

```powershell
uv sync --frozen --all-extras
```

Runtime configuration is read from environment variables. `.env.example`
documents the required names; real credentials must not be committed.

## Quality gate

Run the T001 gate from the repository root:

```powershell
uv run ruff format --check .
uv run ruff check .
uv run mypy src tests
uv run pytest
```

Apply formatting with `uv run ruff format .`.

## Service entry points

The application factories load and validate service-specific configuration at
startup:

```powershell
uv run uvicorn platform_app.application:create_app --factory
uv run uvicorn pseudo_university_app.application:create_app --factory
```

## Migration entry points

Each service owns its migration history and database URL:

```powershell
uv run alembic -c migrations/platform.ini upgrade head
uv run alembic -c migrations/pseudo_university.ini upgrade head
```

The platform service reads `PLATFORM_DATABASE_URL`. The pseudo-university
service reads `PSEUDO_UNIVERSITY_DATABASE_URL`.
