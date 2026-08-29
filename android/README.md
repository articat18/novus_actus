# Novus Actus Interveniens — Android app

A hackathon happy-path Android app (Kotlin + Jetpack Compose) that talks **directly to
an external Postgres database**. It provides email/password sign-in, a profile page, a
leaderboard, and data-driven notifications.

> ⚠️ **Architecture note / happy-path caveat.** For the sake of a self-contained
> hackathon demo, the app connects straight to Postgres from the device using the JDBC
> driver, and password hashing is a simple salted SHA-256. **Do not ship this as-is.** A
> production app would put a REST/GraphQL backend in front of the database (so DB
> credentials never live on the device), use a slow password hash (bcrypt/argon2) on the
> server, verify emails, and deliver notifications via FCM. Everything here is optimised
> for "works end-to-end in a demo", not security.

## Features

- **Sign in / register** with email + password only (no OAuth, no email verification).
- **Profile** — avatar initials, points, live leaderboard rank, member-since, edit your
  display name, and an "earn +50 points" action.
- **Leaderboard** — everyone ranked by points, medals for the top 3, your row
  highlighted.
- **Notifications** — an in-app list *and* real Android system-tray notifications. When
  data changes (e.g. you earn points or climb the ranks), a `notifications` row is
  written and a background `WorkManager` job pushes it to the phone.

## Prerequisites

- Android Studio (or the Android SDK + command-line tools) with an emulator or device.
- JDK 17+ (JDK 22 is fine).
- A reachable Postgres database (local, or a cloud one like Supabase / Neon / Railway).

## 1. Set up the database

```bash
createdb novus_actus
psql "postgresql://postgres:postgres@localhost:5432/novus_actus" -f db/schema.sql
psql "postgresql://postgres:postgres@localhost:5432/novus_actus" -f db/seed.sql   # optional demo data
```

`db/schema.sql` creates the `users` and `notifications` tables. `db/seed.sql` adds six
demo players and a couple of starter notifications.

**Demo accounts** (all use password `demo1234`): `alan@novus.dev`, `grace@novus.dev`,
`ada@novus.dev`, `margaret@novus.dev`, `katherine@novus.dev`, `linus@novus.dev`.
Or just tap **Create a profile** in the app.

## 2. Configure the connection

Copy the example and fill in your values (this file is git-ignored):

```bash
cp local.properties.example local.properties
```

```properties
sdk.dir=/Users/you/Library/Android/sdk

DB_HOST=10.0.2.2        # 10.0.2.2 = the host machine's localhost, seen from the emulator
DB_PORT=5432
DB_NAME=novus_actus
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSLMODE=disable      # use "require" for most managed cloud databases
```

> **Emulator networking:** an Android emulator cannot see `localhost` — that points at the
> emulator itself. Use `10.0.2.2` to reach Postgres running on your computer. For a cloud
> database, use its host and set `DB_SSLMODE=require`.

These values are injected into `BuildConfig` at build time (see `app/build.gradle.kts`).

## 3. Build & run

From Android Studio: open the `android/` folder and press **Run**.

From the command line:

```bash
./gradlew :app:assembleDebug                 # build the APK
./gradlew :app:installDebug                  # install onto a running emulator/device
```

The built APK lands in `app/build/outputs/apk/debug/app-debug.apk`.

## How the "data → notification" path works

1. On the Profile tab, **+50 points** calls `ProfileRepository.addPoints()`, which updates
   the user's `score` and inserts a row into `notifications` (a rank-climb message if you
   overtook someone, otherwise a points message) — all in one transaction.
2. It then kicks `NotificationPollWorker.runNow()`, which reads any `is_delivered = false`
   rows for the current user, posts each to the system tray via `Notifier`, and marks them
   delivered.
3. A periodic `WorkManager` job (every 15 min) does the same in the background, so
   notifications written by *anything* touching the database eventually reach the user.

## Project layout

```
android/
├─ db/
│  ├─ schema.sql            # tables + indexes
│  └─ seed.sql              # demo users & notifications
├─ app/src/main/
│  ├─ AndroidManifest.xml
│  └─ java/com/novusactus/interveniens/
│     ├─ NovusActusApp.kt           # Application: notification channel + session load
│     ├─ MainActivity.kt            # Compose host
│     ├─ data/                      # DbConfig, Database (JDBC), repositories, models
│     ├─ session/UserSession.kt     # current user (memory + SharedPreferences)
│     ├─ notifications/             # Notifier + WorkManager poll worker
│     └─ ui/                        # Compose screens, view models, theme
└─ local.properties(.example)       # SDK path + DB credentials (git-ignored)
```

## Tech

Kotlin · Jetpack Compose (Material 3) · Coroutines · WorkManager · PostgreSQL JDBC driver
· AGP 9 / Gradle 9 · minSdk 26.
