# Novus Actus Interveniens

A TypeScript MERN MVP for energy rankings. The public leaderboard compares household aggregates, while the members-only room view compares rooms inside households the signed-in user belongs to. Lower kWh per occupant produces a higher rank in both views.

## Local development

Requirements: Node.js 20+ and access to the MongoDB Atlas cluster referenced by `MONGODB_URI` in the parent directory's `.env` file.

The app uses the dedicated `novus_actus` database by default, even when the URI has no database path. Set `MONGODB_DB_NAME` only if a different database name is required.

```bash
cd webapp
npm install
npm run seed
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The Vite frontend proxies `/api` requests to the local Express server on port 3001.

The idempotent seed creates five sample households and this demo account:

```text
resident1@novus.demo
demo1234
```

## Useful commands

```bash
npm run typecheck     # TypeScript validation
npm test              # Leaderboard calculation tests
npm run build         # Production frontend build
npm run test:browser  # Chromium happy-path smoke test
```

## Vercel deployment

1. Import this repository and set the Vercel **Root Directory** to `webapp`.
2. Add `MONGODB_URI` and a long random `JWT_SECRET` in the Vercel project environment variables. `MONGODB_DB_NAME` is optional and defaults to `novus_actus`.
3. Ensure MongoDB Atlas network access permits connections from the deployment environment.
4. Deploy. `vercel.json` builds the Vite client, sends `/api/*` to Express, and supports client-side route refreshes.

Run `npm run seed` locally once against the desired Atlas database before the presentation if sample leaderboard data is wanted.

## Data model

- `User`: `name`, normalized unique `email`, bcrypt-hashed `password`.
- `Room`: display `name`, exactly one `user`, integer `pax`, and timestamped kWh `usage` readings.
- `Household`: display `name` and an array of `rooms`.

For each period, the household leaderboard sums qualifying room readings and divides by total household occupants. The room view divides each room's readings by its `pax`; its API first verifies that the signed-in user is registered under a room in the requested household and never returns resident identity fields.
