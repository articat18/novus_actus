-- ============================================================================
-- Novus Actus Interveniens — database schema
-- ----------------------------------------------------------------------------
-- Run this against your Postgres database before using the app, e.g.:
--   createdb novus_actus
--   psql "postgresql://postgres:postgres@localhost:5432/novus_actus" -f db/schema.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    score         INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard ordering: highest score first, ties broken by who joined earlier.
CREATE INDEX IF NOT EXISTS idx_users_score ON users (score DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS notifications (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    body         TEXT NOT NULL,
    -- is_read:      the user has seen it inside the app's Notifications tab
    -- is_delivered: it has been pushed to the phone's system notification tray
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    is_delivered BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id, created_at DESC);

-- Fast lookup for the background worker that pushes undelivered rows to the tray.
CREATE INDEX IF NOT EXISTS idx_notifications_pending
    ON notifications (user_id) WHERE is_delivered = FALSE;
