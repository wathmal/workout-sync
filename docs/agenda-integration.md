# Agenda view integration

Design for completing the dashboard "This week." agenda (`components/dashboard/WeeklyAgenda.tsx`),
replacing its mock data (`lib/dashboard/mock-data.ts → overviewMock.agenda`) with a live merge of
**Hevy + Garmin + Google Calendar**. Decisions captured here; code is canonical once written.

Status: **design only, not yet built.**

## Scope

- In scope: the **Mon–Sun day-card row** for the **current ISO week** only. No week-navigation arrows.
- Out of scope (stays mock for now): the header strip — `STREAK · WEEKLY LOAD · BODY FAT · RACE IN`
  and the `"Push day. 8 km easy after."` title/subtitle (`OverviewHeading.tsx`). Separate follow-up.

## Per-day source switch

Timezone is `USER_TZ` (AU). The day flips **whole-day at 21:00 local** — no hybrid/mixing within a day.

```
future day   OR  today < 21:00   ->  Google Calendar   (status: PLANNED)
today >= 21:00  OR  past day      ->  Hevy + Garmin      (status: DONE)
neither of the above              ->  REST
```

- A planned calendar item on a **past** day that was never done shows as nothing → the day is just `REST`.
  Calendar is ignored entirely for past/after-21:00 days.
- A workout logged this morning stays **hidden until 21:00** today — today reads as PLANNED (calendar)
  until the flip. This is intentional.
- "now" and the day boundary are computed **server-side** in `USER_TZ`, never the client clock.

## Cards

No category tags / coloured badges — the push/pull/run badges and the `52m · 5.8t` style meta in the
current mock were **demo only** and are dropped.

| Status  | Title source                          | Meta                | Pill    |
|---------|---------------------------------------|---------------------|---------|
| Done    | Hevy title, else Garmin activity name | duration only (`52m`)| DONE    |
| Planned | calendar event title, **verbatim**    | none                | PLANNED |
| Rest    | —                                     | —                   | REST    |

Done/Planned/Rest counts in the section header are derived from the assembled cards.

## Calendar parsing

The calendar is a **mixed personal calendar** (workouts + bills + work + appointments), so parsing is a
strict **whitelist**:

- Emit a card **iff** the event title starts with one of `Move` / `Perform` / `Race` / `Track`
  (case-insensitive — the original verb list).
- The card name is the **full title, as-is** (e.g. `Move Total`, `RACE PREP`). The verb is not stripped,
  X is not split out.
- Everything else is ignored (`Pay ANZ CC`, `Voqi: …`, `Sara home visit`, `Bupa Health …`, …).
- No cross-link to the `race_event` table — `Race …` titles are plain planned cards.

## De-dup (Garmin vs Hevy)

Same session can appear in both — a strength workout logged in Hevy while wearing the watch, **or a run
logged in both Hevy and Garmin**, or a Hyrox sim that Garmin records as a "run". Rule (interval overlap,
any activity type):

```
[garmin.start, garmin.end] overlaps [hevy.start, hevy.end]   (strict)
    -> drop the Garmin activity, keep Hevy   (Hevy is SOT)
otherwise (standalone run/walk with no Hevy counterpart)
    -> keep Garmin as its own card
```

`garmin.end = start + durationS`; `hevy.end = end_time` (falls back to start if absent). Type-agnostic:
a run logged in both places de-dups to the Hevy card. Strict overlap (`<`, not `<=`) so a run that starts
exactly when a lift ends — genuinely back-to-back, not the same session — is kept. Trade-off: when a run
is in both, you keep the Hevy card and lose Garmin's distance/pace; merging Garmin metrics into a matched
Hevy card is a noted future item, not done.

## Garmin integration

**Library: `garminconnect` (Python, cyberjunky).** Chosen on a security review of the alternatives:

- Password is **never written to disk**; only exchanged for tokens during one-time login.
- Token store `~/.garminconnect/garmin_tokens.json` written `mode 0600`; bootstrap-once + silent
  OAuth2 auto-refresh thereafter.
- MFA supported (`prompt_mfa` callback).
- 3 direct deps (`curl_cffi`, `requests`, `ua-generator`); actively maintained — the **only** option
  patched after Garmin's 2025 SSO change.
- Rejected: `garth` (deprecated, "new logins will not work"); `garmy` (stale, token files not 0600,
  garth-style SSO possibly broken); Node `garmin-connect` (stores **raw password in plaintext**
  `garmin.config.json`, no MFA, abandoned since Jan 2024).

**Auth flow** (pure HTTP, no browser — `curl_cffi` spoofs a TLS fingerprint to clear Cloudflare):

```
POST user/pass -> sso.garmin.com (ticket) [+ MFA code]
  -> OAuth1 token (~1yr) -> OAuth2 "DI" bearer (hours, auto-refreshed)
  -> connectapi.garmin.com (activities)
```

**Runtime: Python in the web Docker image**, invoked as a subprocess by the sync route.
- FFI / in-process embedding rejected — same Python+`curl_cffi` native footprint, but worse isolation
  (a native crash or hung login would take down the Next.js process).
- **Token delivery — credentials + container-local cache, no volume.** Give `GARMIN_EMAIL` +
  `GARMIN_PASSWORD` (account **2FA must be off**). `fetch.py` caches the token in `GARMIN_TOKEN_DIR`
  (default `/tmp/garmin-token`, on the container's writable layer — no mounted volume) and:
  loads it if valid → DI-refreshes if the access token lapsed → falls back to an email+password login if
  both tokens are dead, then `client.dump()`s the fresh token back so subsequent runs reuse it. Fully
  self-healing, no human step. The cache is lost on container recreate, after which the next run silently
  re-mints. `GARMIN_TOKEN_B64` (from off-box `bootstrap.py`, tar.gz or a single `garmin_tokens.json`,
  base64) is an **optional first-boot seed** only.
  - **Why credentials + write-back, not env-only:** the original design assumed `garminconnect` rode
    `garth`'s OAuth1 (~1yr durable) + OAuth2, where a read-only env token self-refreshes ~yearly. That is
    false now — `garminconnect` (pinned `==0.3.6`) dropped `garth` and uses Garmin **DI auth**: a
    short-lived access token (~28h) with a **rotating** refresh token. A read-only env value cannot survive
    rotation, so it dies within ~a day of the access token first lapsing (the bug we hit:
    `DI token refresh failed: 400 invalid_grant` → "Failed to retrieve social profile"). `garth` is also
    deprecated/Cloudflare-blocked, so reverting is not an option. Hence: store credentials, let the lib
    auto-relogin, and persist (write-back) the rotated token. Pin the lib so the auth model can't shift
    again silently.
  - **Security:** this stores the Garmin password at rest (a deliberate reversal of the old
    "password never stored" stance). Prefer a secrets store over plaintext env; restrict file perms.
- Subprocess **stdout must be clean JSON** — apply the `_silence` stdout-redirect pattern used by the
  `claude-cli` agent shims (`scripts/agent-tools/_silence`), or boot prints corrupt the parent's parse.
- Dockerfile: add `python3` + `pip install garminconnect` to the runtime stage.

## Calendar integration

**Auth: GCP service account.** Create a service account, download its `key.json` (stored as a secret),
then **share the personal calendar read-only** with the SA's email. No OAuth consent flow, no refresh
token, **no expiry** — the right fit for unattended cron. (OAuth refresh tokens expire every 7 days
unless the app is published — avoided.)

**Library:** `google-auth-library` + a REST `events.list` call (lighter than the full `googleapis`).

## Storage

Two new Drizzle tables in Postgres (add to `drizzle.config.ts` schema list, then `db:generate`):

```
garmin_activity   garmin_id (PK), start_time, activity_type, name, duration_s, distance_m, raw (jsonb)
calendar_event    gcal_id  (PK), start, title, raw (jsonb)
```

Sync upserts (`ON CONFLICT DO UPDATE`) — idempotent, never dupes. Calendar rows outside the window are
pruned so deleted/moved events disappear. Hevy is **not** cached here — it is read live from
`/api/hevy-workouts` at build time (its own SOT).

## Sync

`POST /api/agenda/sync` (behind a shared-secret header):

```
spawn  python garmin_fetch.py  (loads token, fetches activities) -> stdout JSON -> upsert garmin_activity
fetch  Google Calendar events (service account)                  ->            -> upsert calendar_event
```

Triggered by:
- **TrueNAS cron** — `*/30 * * * *` (calendar edits) + `30 21 * * *` (day's finished Garmin activities) —
  `curl -X POST <app>/api/agenda/sync -H "x-sync-secret: …"`.
- The existing **top-nav Refresh button** (`app/_components/top-nav.tsx`) — calls the same-origin server
  action `syncAgendaAction` (`app/_actions/agenda.ts`), NOT the route, so the client never needs the
  secret. Both entry points call the shared `runAgendaSync()` in `lib/agenda/sync.ts`. Refresh now takes
  seconds (Garmin login); the existing spinner + `SyncStatusBadge` cover the UX.

`AGENDA_SYNC_SECRET` guards only the cron route (`x-sync-secret`); when unset the route is open (dev). Set
it in any internet-exposed deploy.

There is **no in-app scheduler** — the cron lives outside the app (matches the repo's request-driven /
build-time-only convention). `pg_cron` was rejected: not in `postgres:16-alpine`, runs SQL only, can't
do the HTTP/auth, would just re-trigger the app anyway.

## Merge

Server-side, pure, unit-testable:

```
lib/dashboard/agenda.ts
  buildAgenda(hevy, garmin, calendar, now, USER_TZ) -> DayAgenda[]
    - bucket sources by local day
    - apply per-day source switch (21:00 flip)
    - de-dup Garmin vs Hevy
    - map to cards (title + duration | title; status pill)
```

```
GET /api/agenda
  read garmin_activity + calendar_event (Postgres)
  fetch Hevy workouts (current week)
  buildAgenda(...) -> DayAgenda[]
```

New `app/_providers/agenda-provider.tsx` holds the result; `WeeklyAgenda` reads it. **No Garmin/Google
call on dashboard render** — only Postgres reads + the existing Hevy fetch.

## Open items (resolve at build)

- Exact Garmin `activityType` values counted as "strength" for de-dup.
- 90-minute overlap threshold (tunable).
- Calendar sync window (current week ± buffer).
- New env: `GARMIN_EMAIL`/`GARMIN_PASSWORD` (+ optional `GARMIN_TOKEN_DIR`, `GARMIN_TOKEN_B64` seed),
  `GOOGLE_SA_KEY` (or path), `GCAL_ID`, `AGENDA_SYNC_SECRET`.
- Dockerfile: `python3` + `garminconnect==0.3.6` in the runtime stage; no token volume (cached on the
  container's writable layer at `GARMIN_TOKEN_DIR`).
- Whether de-dup should *merge* Garmin cardio metrics into a matched Hevy card later (currently:
  drop-Garmin-keep-Hevy only). Out of scope now.
