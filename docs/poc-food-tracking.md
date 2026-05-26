# Food Tracking

Personal food/macro logger. Mirrors workout pipeline (photo → vision → match → review → log) but persists to local SQLite instead of an external service. This doc captures requirements + design intent. Code is canonical once written.

## Goals

- Track kcal + macros only: protein, carbs, fat. No micros, no fiber, no sodium.
- Bulk photo upload from phone via iOS Shortcut.
- Optional natural-language context per photo (food name, serving, cuisine, ingredients).
- Manual NL input as alternate path (no photo).
- User-defined constants for repeat foods (coffee, protein shake) — bypass match.
- Photo timestamp drives meal time (EXIF), manual override allowed.
- Single user. Highly personalised — no multi-tenant concerns.

## Non-goals (v1)

- Multi-user, social, sharing.
- Recipe building, meal planning, grocery lists.
- Micronutrients, vitamins.
- Offline-first PWA.
- Cloud sync (local-only first; revisit if Shortcut needs public endpoint).

## Stack additions

- SQLite via `better-sqlite3` — local file `data/food.db` (gitignored). Native module; pin version, verify darwin arm64 build.
- USDA FoodData Central (FDC) — free REST API. `FDC_API_KEY` env var.
- Existing infra reused as-is: Groq vision, `lib/embeddings/` providers, `lib/image-utils.ts` (HEIC + EXIF), `components/NumberInput.tsx`, shadcn primitives.

## Data flow

```
Photo(s) → /api/food/ingest → EXIF ts → vision (Groq)
        → items [{ name, amount_g, cooking_method, kcal_estimate? }]
        → optional user context text (passed into prompt or post-extraction)
        → match each item: constants alias → fuzzy + embedding vs FDC catalog
        → top-3 candidates per item
        → SQLite food_entry (status=pending) + food_item rows
        → review UI (edit grams, swap candidate, override macros)
        → status=logged
```

```
Manual NL  → /api/food/ingest (text branch) → text-only Groq → same matcher → review
Constant   → alias hit → skip vision/match → apply stored macros → pending
Shortcut   → 202 + entryId immediately, processing async, web app shows pending badge
```

## Directory layout

```
app/
  api/food/
    ingest/route.ts       POST: photo|text → entry id (sync or 202)
    entries/route.ts      GET list, GET/PATCH/DELETE one
    constants/route.ts    GET/POST/PATCH/DELETE templates
    daily/route.ts        GET totals + entries for date
  food/
    page.tsx              today's totals (MacroBar) + entries
    review/page.tsx       edit pending entries (mirrors app/review/page.tsx)
    constants/page.tsx    manage user templates
  _providers/
    food-provider.tsx     pending entries, targets, today's totals
components/
  FoodItemCard.tsx        edit row (mirrors ExerciseCard.tsx)
  MacroBar.tsx            kcal/P/C/F vs target
lib/
  food/
    vision.ts             Groq prompt + extract call
    nl-parse.ts           text-only Groq for manual logs
    match.ts              client-safe entry: fuzzy + lazy-import embeddings
    match-server.ts       server-only embeddings caller (mirrors hevy/match-server.ts)
    constants.ts          alias resolver, template loader
    db.ts                 SQLite handle, migrations, prepared statements
    fdc/
      client.ts           FDC REST + cache
      types.ts
    types.ts              FoodItem, FoodEntry, MacroSet
  data/
    fdc-foods/catalog.json         pre-fetched FDC subset
    food-embeddings/<provider>/    pre-built vector catalog
data/                     runtime (gitignored): food.db, food-photos/
scripts/
  refresh-fdc-catalog.ts           paginate FDC, write catalog.json
  build-food-embeddings.ts         vector catalog generator
  debug-food-match.ts              CLI score breakdown
```

## SQLite schema

```sql
CREATE TABLE food_entry (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,           -- unix ms, EXIF or now
  source        TEXT NOT NULL,              -- 'photo' | 'text' | 'shortcut' | 'constant'
  status        TEXT NOT NULL,              -- 'pending' | 'logged' | 'discarded'
  photo_path    TEXT,                       -- relative under data/food-photos/
  user_context  TEXT,                       -- optional NL hint
  raw_extract   TEXT,                       -- JSON: Groq raw response
  notes         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE food_item (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id     INTEGER NOT NULL REFERENCES food_entry(id) ON DELETE CASCADE,
  fdc_id       INTEGER,                     -- nullable: matched FDC entry
  constant_id  INTEGER REFERENCES food_constant(id),
  name         TEXT NOT NULL,
  amount_g     REAL NOT NULL,
  kcal         REAL NOT NULL,
  protein_g    REAL NOT NULL,
  carbs_g      REAL NOT NULL,
  fat_g        REAL NOT NULL,
  confidence   REAL,                        -- 0..1 from vision/match
  candidates   TEXT                         -- JSON: top-3 alternates
);

CREATE TABLE food_constant (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  aliases          TEXT NOT NULL,           -- JSON string[]
  default_amount_g REAL NOT NULL,
  kcal             REAL NOT NULL,
  protein_g        REAL NOT NULL,
  carbs_g          REAL NOT NULL,
  fat_g            REAL NOT NULL,
  auto_log         INTEGER NOT NULL DEFAULT 0  -- skip review when 1
);

CREATE TABLE fdc_cache (
  fdc_id     INTEGER PRIMARY KEY,
  payload    TEXT NOT NULL,                 -- JSON: full FDC entry
  fetched_at INTEGER NOT NULL
);

CREATE TABLE food_target (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  kcal       REAL NOT NULL,
  protein_g  REAL NOT NULL,
  carbs_g    REAL NOT NULL,
  fat_g      REAL NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_entry_ts     ON food_entry(ts);
CREATE INDEX idx_entry_status ON food_entry(status);
CREATE INDEX idx_item_entry   ON food_item(entry_id);
```

## API endpoints

```
POST /api/food/ingest
  Body (photo):  { image: base64, mimeType, filename, context?, async? }
  Body (text):   { text: string }
  Body (bulk):   { images: [...], context?, async? }
  Auth:          Bearer FOOD_API_TOKEN required when async=true (Shortcut)
  200 sync:      { entryId, items: [...], confidence }
  202 async:     { entryId, status: 'queued' }

GET    /api/food/entries?from=&to=&status=
GET    /api/food/entries/:id
PATCH  /api/food/entries/:id          { items?, status?, notes? }
DELETE /api/food/entries/:id

GET    /api/food/constants
POST   /api/food/constants            { name, aliases, default_amount_g, kcal, p, c, f, auto_log }
PATCH  /api/food/constants/:id
DELETE /api/food/constants/:id

GET    /api/food/daily?date=YYYY-MM-DD
  → { date, totals:{kcal,p,c,f}, target:{...}, entries:[...] }
```

All `/api/food/*` routes force `runtime = "nodejs"` (SQLite needs Node).

## FDC integration

- Search:   `GET https://api.nal.usda.gov/fdc/v1/foods/search?query=&dataType=Foundation,SR%20Legacy&api_key=...`
- Detail:   `GET https://api.nal.usda.gov/fdc/v1/food/{fdcId}?api_key=...`
- Auth:     `api_key` query param. Server-only.
- Catalog:  `scripts/refresh-fdc-catalog.ts` mirrors `scripts/refresh-hevy-catalog.ts`:
  - Pre-fetch Foundation + SR Legacy datasets (~8k common whole foods).
  - Filter to entries with kcal + P/C/F populated.
  - Strip to lean shape: `{ fdcId, name, dataType, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g }`.
  - Sort deterministically by `fdcId` for reviewable diffs.
  - Write `lib/data/fdc-foods/catalog.json`.
  - Soft-fail when `FDC_API_KEY` missing — use committed catalog (Docker / fork builds).
  - Run as `prebuild` step alongside `refresh:hevy`.
- Branded foods (Open Food Facts) deferred — macros-only goal doesn't need barcode/branded coverage.

## Food matching

Threshold ≥60 (mirrors exercise matcher).

1. **Constants alias check first.** Lowercase name ∈ aliases → return constant entry, skip catalog + vision re-prompt.
2. **Fuzzy base** — Levenshtein on normalized name + word overlap (+10/match) + same starting word (+20).
3. **Embedding boost** — top-3 vector candidates (cosine vs pre-built food catalog). Blend follows `lib/hevy/exercises.ts` `blendScore()` pattern: vector contributes only above `EMBEDDING_COS_THRESHOLD`, capped at `EMBEDDING_BOOST_MAX`.
4. **Cooking-method filter** — if vision flagged `grilled`/`raw`/`fried`, prefer FDC entries whose name contains the matching keyword.
5. **Macro range filter** — if vision returned `kcal_estimate`, prefer candidates within ±30% kcal/100g. Drops absurd matches (e.g. "fried" picked when raw expected).
6. **Top-3 to UI.** Auto-pick #1 with confidence flag. Review screen shows alternates for one-click swap.

Tunable via env (separate from exercise matcher to allow independent tuning):

| Var | Default | Purpose |
|-----|---------|---------|
| `FOOD_MATCHING_MODE` | `both` | `fuzzy` / `vector` / `both` |
| `FOOD_EMBEDDING_SOURCE` | `auto` | `lm-studio` / `transformers` / `auto` / `off` |
| `FOOD_EMBEDDING_BOOST_MAX` | `30` | Max additive boost in `both` mode |
| `FOOD_EMBEDDING_COS_THRESHOLD` | `0.55` | Cosine below this contributes 0 |

## Vision prompt

Reuse `callGroqVision()` / `callLMStudioVision()` from `app/api/process-workout/route.ts` — extract to `lib/groq/vision.ts` (shared). Food-specific prompts live in `lib/groq/food-prompts.ts`:

```
FOOD_EXTRACTION_SYSTEM_PROMPT
FOOD_EXTRACTION_USER_PROMPT
FOOD_EXTRACTION_JSON_SCHEMA
```

Output schema:

```json
{
  "foods": [
    {
      "name": "string",                 // generic, no brand
      "amount_g": 0,                    // estimated grams
      "cooking_method": "grilled|fried|raw|baked|boiled|...",
      "notes": "string?",               // sauce, oil, garnish
      "kcal_estimate": 0                // optional rough hint for range filter
    }
  ],
  "meal_type": "breakfast|lunch|dinner|snack",
  "confidence": 0.0
}
```

User context, when provided, is appended to the user prompt:
`"Additional context from user: {context}"`

## iOS Shortcut

Shortcut composes:

```
POST {BASE_URL}/api/food/ingest
Authorization: Bearer {FOOD_API_TOKEN}
Content-Type: application/json
{ "image": "<base64>", "mimeType": "image/jpeg", "filename": "IMG_1234.HEIC", "async": true }
```

Server: validates token, persists photo to `data/food-photos/<entryId>.<ext>`, inserts pending `food_entry`, returns `202 { entryId }` immediately. Vision + match runs in-process after response (no worker queue — single user, low volume). Web app `/food` shows pending count badge; user reviews when at desk.

Token: single static value in `.env.local` (`FOOD_API_TOKEN`). Personal scope. Rotate manually if leaked.

For public endpoint exposure: Tailscale or ngrok (local-only) or deploy to Vercel + remote DB (deferred — see Open decisions).

## UI

| Route | Purpose |
|-------|---------|
| `/food` | Today's totals (MacroBar) + entries grouped by meal |
| `/food/review` | Pending entries, inline edit (mirrors `app/review/page.tsx`) |
| `/food/constants` | CRUD user templates |
| `/food/history` | Week/month chart (deferred) |

`FoodItemCard`: name (swap from candidates dropdown), `amount_g` (`NumberInput`), kcal/P/C/F (auto-computed from FDC per-100g × amount, editable for manual override). Mirrors `ExerciseCard.tsx` layout — set rows replaced by item rows.

`MacroBar`: 4 progress bars (kcal/P/C/F) with target line. Reuse Tailwind theme vars from `app/globals.css`.

State held in `app/_providers/food-provider.tsx`.

## Error handling

| Type | Trigger | UI |
|------|---------|-----|
| Hard | Bad file type, file >20MB, missing image+text | Red banner |
| Soft | `GROQ_API_KEY` missing, network fail, rate limit | Yellow banner, no auto-fallback (food can't be mocked usefully — better to surface failure) |
| Auth | Bearer token missing/wrong on async route | 401 JSON |
| Match | No candidate ≥60 score | Item kept with `confidence=0`, review forces user action |

## Testing

- Unit (colocated):
  - `lib/food/match.test.ts` — alias short-circuit, blend, range filter
  - `lib/food/nl-parse.test.ts` — manual text → items
  - `lib/food/fdc/client.test.ts` — pagination, cache, soft-fail
- E2E in `tests/e2e/`:
  - `food-photo-e2e.ts` — real Groq + FDC catalog match on fixture
  - `food-text-e2e.ts` — NL ingestion path
  - `food-shortcut-e2e.ts` — async ingest + 202 + entry retrieval
- Fixtures in `tests/fixtures/`: `food-meal-1.jpeg`, `food-meal-2.heic`.
- Debug: `tsx scripts/debug-food-match.ts "grilled chicken"` — score breakdown.

## Env vars

| Var | Required | Purpose |
|-----|----------|---------|
| `FDC_API_KEY` | yes (build-time, soft-fail at runtime) | USDA FoodData Central |
| `FOOD_API_TOKEN` | yes for Shortcut | Bearer auth on async ingest |
| `GROQ_API_KEY` | shared with workout flow | Vision extraction |
| `FOOD_MATCHING_MODE` | no | See Matching table |
| `FOOD_EMBEDDING_SOURCE` | no | See Matching table |
| `FOOD_EMBEDDING_BOOST_MAX` | no | See Matching table |
| `FOOD_EMBEDDING_COS_THRESHOLD` | no | See Matching table |
| `FOOD_PHOTO_RETENTION_DAYS` | no (default `90`) | Cleanup job threshold |

## Constraints / gotchas

- **Server-only boundary.** `lib/food/match-server.ts` uses `import "server-only"`. Client-safe `lib/food/match.ts` lazy-imports it via dynamic `await import()`. Same pattern as `lib/hevy/exercises.ts` ↔ `lib/hevy/match-server.ts`. Adding a top-level import will pull `fs` / `@huggingface/transformers` into client bundle.
- **SQLite needs Node runtime.** Force `export const runtime = "nodejs"` on every `/api/food/*` route. Edge runtime breaks `better-sqlite3`.
- **Gitignore.** Add `data/` (DB + photos) and `lib/data/fdc-foods/cache/` if temp files appear during refresh.
- **Photo retention.** `data/food-photos/` grows fast. Default 90-day retention (cleanup job triggered on cold start or daily endpoint hit). Configurable via `FOOD_PHOTO_RETENTION_DAYS`.
- **Image limits.** Inherited from Groq: ≤20MB, ≤33 megapixels, base64 request ≤4MB. Reuse HEIC handling from `lib/image-utils.ts`.
- **Scripts + `server-only`.** Run with `NODE_OPTIONS=--conditions=react-server` (already set in npm scripts).
- **Better-sqlite3 native build.** Pin a version known to ship prebuilds for darwin arm64 + linux/amd64 (Docker target). Add to `outputFileTracingIncludes` if standalone Docker output misses the binary.
- **Embedding catalog rebuild.** Only when FDC catalog `fdcId` set changes — mirror `--check-or-rebuild` pattern from existing embeddings build.

## Implementation phases

Sequential; each phase produces a usable slice.

1. SQLite + schema + targets config + `.gitignore` entries + `lib/food/db.ts`.
2. `/api/food/ingest` minimal: photo or text → pending `food_entry`, no vision/match. Bearer auth wired.
3. Extract `callGroqVision` to `lib/groq/vision.ts`. Build food prompts. Vision call wired into ingest. No matcher yet — items stored as-is.
4. FDC client + cache + `scripts/refresh-fdc-catalog.ts` + `catalog.json` committed.
5. Fuzzy match (no embeddings) → review page + `FoodItemCard` → entry transitions to `logged`.
6. Embedding catalog build (`scripts/build-food-embeddings.ts`) + blended matcher + top-3 candidates UI.
7. Daily totals page (`/food`) + `MacroBar` + targets CRUD.
8. Constants table + alias short-circuit + `/food/constants` page.
9. Manual NL input UI + `nl-parse.ts`.
10. iOS Shortcut docs (sample shortcut export) + async path + pending queue badge.
11. E2E suite + week/history view.

## Open decisions

- **Hosting.** Local-only Mac (simplest, but Shortcut needs LAN) vs Vercel + Turso (public Shortcut, +complexity). Default: local + Tailscale tunnel.
- **Photo retention.** Keep originals 90d (default) vs hash + thumbnail only (saves storage, loses re-extract option).
- **Auto-log threshold.** Skip review when match confidence ≥ X? Default off — always review v1.
- **Composite meals.** Single entry with N items vs nested "recipe" entity. v1: flat list of items per entry.
- **Workout DB integration.** Keep workout pipeline separate (Hevy-backed) vs migrate to same SQLite later. v1: separate.

## Open tech debt (predicted)

- Photo cleanup job has no scheduler — runs on demand. Add cron/launchd later.
- Bearer auth uses single static token. Consider rotating-token scheme if multiple devices.
- `FoodItemCard` will likely duplicate logic from `ExerciseCard.tsx`. Extract shared row primitives if duplication >50%.
