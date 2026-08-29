-- ============================================================================
-- Novus Actus Interveniens — demo seed data
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql:
--   psql "postgresql://postgres:postgres@localhost:5432/novus_actus" -f db/seed.sql
--
-- Every demo account below uses the password:  demo1234
-- (The password_hash values are salted SHA-256 hashes matching the app's scheme,
--  so you can sign in with any of these emails, or just register a new account.)
-- ============================================================================

INSERT INTO users (email, password_hash, display_name, score) VALUES
    ('alan@novus.dev',      '5f123250056f79aa2d07b16e1ac3a0278f90e2ee9bde7f5a832689ef223d7656', 'Alan Turing',        1420),
    ('margaret@novus.dev',  'd526399639777b1b0c81159ead6b7b0950d629b1a1aaca8ea1c7e05b2fe9f1ed', 'Margaret Hamilton',  1310),
    ('grace@novus.dev',     '83d3e8527fe41fba110675109ccb1a5d95810dcef1224101e55cc13ceb1177dd', 'Grace Hopper',       1150),
    ('ada@novus.dev',       '3d3863085e13ac96c1e54b9721c36f5b04aff40af712654229a4c23c0eb58e4d', 'Ada Lovelace',        980),
    ('katherine@novus.dev', '8914186f278ae70c1e6c9d08feff1d61f617d3adfae0192e61f5ff09f0b499f3', 'Katherine Johnson',   890),
    ('linus@novus.dev',     '62329bb8e7e8c1ee24a789aa23f4c41d3e9cc930f9ad97ddb7751034ae837a4d', 'Linus Torvalds',      760)
ON CONFLICT (email) DO NOTHING;

-- Seed a couple of undelivered notifications for the top player so the very first
-- open of the app demonstrates a data-driven push to the system tray.
INSERT INTO notifications (user_id, title, body, is_delivered)
SELECT u.id, 'You are #1 🏆', 'You hold the top spot on the leaderboard. Defend it!', FALSE
FROM users u
WHERE u.email = 'alan@novus.dev'
  AND NOT EXISTS (
      SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.title = 'You are #1 🏆'
  );

INSERT INTO notifications (user_id, title, body, is_read, is_delivered)
SELECT u.id, 'Welcome back 👋', 'Grace and Margaret are catching up — earn points to stay ahead.', FALSE, FALSE
FROM users u
WHERE u.email = 'alan@novus.dev'
  AND NOT EXISTS (
      SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.title = 'Welcome back 👋'
  );
