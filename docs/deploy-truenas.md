# Deploying on TrueNAS SCALE (Fangtooth 25.04+)

Fangtooth's apps engine is Docker, so the **Custom App → Install via YAML** flow
takes a Compose file directly. The canonical stack is `docker-compose.prod.yml`
(app image from GHCR + Postgres). The app image runs pending Drizzle migrations
on start (`scripts/migrate-runtime.mjs`), so the DB self-migrates on every update
— no manual migrate step.

## 0. Image
Pushes to `main` trigger the **Build and publish container** workflow →
`ghcr.io/wathmal/workout-sync:main` (pin a `:sha` for reproducibility). If the
GHCR package is private, make it public or add registry credentials in TrueNAS.

## 1. Dataset for the DB
Storage → Datasets → create e.g. `POOL/apps/workout-sync/pgdata`. Host path:
`/mnt/POOL/apps/workout-sync/pgdata`. This persists across image updates and is
what you snapshot.

## 2. Install
Apps → **Discover** → top-right **⋮ → Install via YAML** → Name `workout-sync` →
paste `docker-compose.prod.yml` into **Custom Config**, filling the values
(`docker compose` `${VAR}` interpolation isn't applied by the TrueNAS panel, so
substitute the real values inline, using `env.deploy.example` as the checklist).
Set the `db` volume to the dataset host path from step 1.

## 3. First boot
The app container migrates the fresh volume then serves. App logs should show
`migrate: schema up to date` then `Ready`. Browse `http://<truenas>:3000`.

## 4. Seed (optional)
The starter macro target + sample races aren't auto-seeded. Set a macro target in
the UI, or run once from a dev checkout against the DB:
`DATABASE_URL=postgres://workout:PASS@<truenas-ip>:<pg-port> npm run db:seed`.

## 5. Cron — Garmin + Calendar sync
System → Advanced → **Cron Jobs**:
```
*/30 * * * *  curl -fsS -X POST http://localhost:3000/api/agenda/sync -H "x-sync-secret: <AGENDA_SYNC_SECRET>"   # calendar edits
30 21 * * *   curl -fsS -X POST http://localhost:3000/api/agenda/sync -H "x-sync-secret: <AGENDA_SYNC_SECRET>"   # day's finished Garmin
```

## 6. Updating (no data loss)
1. Snapshot: `zfs snapshot POOL/apps/workout-sync/pgdata@pre-update` (or via UI).
2. App → Edit/Update → re-pull `:main` (or bump the `:sha`).
3. New container boots → migrate-on-start applies any new migrations to the same
   volume. Idempotent — verified no double-apply, additive migrations keep data.

## CLI / self-host (non-TrueNAS)
```
cp env.deploy.example .env   # fill in
docker compose -f docker-compose.prod.yml up -d
```

Env reference: `env.deploy.example`. Var details: `README.md`, `docs/agenda-integration.md`.
