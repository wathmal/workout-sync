# Food / Macro Logger — Design

Integration of [food-macro-api](https://github.com/voqilabs/food-macro-api) (FMA) into the workout-sync dashboard. Adds a food/meal log with macro tracking against time-boxed targets.

## Scope (MVP)

- Search FDC/AFCD via `GET /v1/foods/search`
- Text analyze via `POST /v1/analyze/text`
- Photo analyze via `POST /v1/analyze` (reuse existing HEIC + EXIF pipeline)
- Time-boxed macro targets (DB-seeded, no editor UI yet)
- Edit grams + delete on logged meals
- Quick-add chips = top-N by 30-day frequency

Deferred: barcode flow, target editor UI, per-item delete inside a meal, multi-device sync, historical adherence per target period.

## Data flow

```
/food (search | text | snap)
  → /api/food/{search,analyze/text,analyze/photo}   ← server-only, holds FMA bearer
  → FMA running locally on :3030
  → editable review rows (grams, low-conf badge, FMA warnings)
  → POST /api/food/log
  → food_log_entry rows
  ↓
food-log-provider re-fetches today + week + quickAdd
  ↓
CalorieSummary renders updated week stack + today's meals
```

## Persistence

Postgres in Docker, separate from FMA's DB. Drizzle ORM, migrations under `drizzle/`.

### Schema

```ts
food_log_entry (
  id uuid pk,
  batch_id uuid not null,                 -- groups items from same analyze call
  logged_at timestamptz not null,
  source enum('search','text','photo','manual'),

  name text,
  grams numeric,
  kcal, protein_g, carbs_g, fat_g numeric,

  -- per-gram rates kept on the row so edit-grams rescales locally
  -- without re-querying FMA
  kcal_per_g, protein_per_g, carbs_per_g, fat_per_g numeric,

  fma_food_id int,
  fma_source text,
  fma_source_id text,
  confidence numeric,
  warnings jsonb,
  raw_response jsonb,                     -- full FMA payload for forensics

  note text,
  created_at timestamptz default now()
)

macro_target (
  id uuid pk,
  start_date date not null,
  end_date date null,                     -- null = active (open-ended)
  kcal, protein_g, carbs_g, fat_g int,
  note text,
  created_at timestamptz default now()
)
```

**Target overlap policy.** Disallowed. Inserting a new period auto-closes the prior by setting `prior.end_date = new.start_date - 1`. Always exactly one active target. Resolved by:

```sql
SELECT * FROM macro_target
WHERE start_date <= :today
  AND (end_date IS NULL OR end_date >= :today)
LIMIT 1
```

**Edit-grams rescale.** Store per-gram rates at commit time. On edit:

```ts
new_kcal = kcal_per_g * new_grams
// same for protein_g, carbs_g, fat_g
```

Equivalent to re-querying FMA (per 100g rates are constant for a given food row). No round-trip needed.

## Repo layout

```
docker-compose.yml             ← root, single db service (postgres:16-alpine)
drizzle/                       ← migration SQL

lib/food/
  schema.ts                    ← drizzle tables
  db.ts                        ← pool, server-only
  fma.ts                       ← thin fetch wrapper (search, analyzeText, analyzePhoto)
  queries.ts                   ← typed read/write fns
  targets.ts                   ← resolve active target by date
  types.ts                     ← Meal, MealItem, MacroTarget, etc.

app/_providers/
  food-log-provider.tsx        ← matches workout-provider shape

app/api/food/
  search/route.ts              ← GET, proxies FMA
  analyze/text/route.ts        ← POST, proxies FMA
  analyze/photo/route.ts       ← POST, HEIC convert → FMA
  log/route.ts                 ← GET today, POST commit, DELETE batch
  log/week/route.ts            ← GET week aggregates
  log/[itemId]/route.ts        ← PATCH grams
  quick-add/route.ts           ← GET top-N
  targets/route.ts             ← GET current

app/food/page.tsx              ← replace placeholder; tabbed input + review
```

## Server-side architecture

### FMA client (lib/food/fma.ts)

Thin fetch wrapper. Reads `FMA_BASE_URL` + `FMA_API_KEY` from env. No SDK dep. Three methods:

```ts
search(q: string, limit?: number): Promise<FmaSearchResponse>
analyzeText(text: string, opts?: { include?: ('trace' | 'rationale')[] }): Promise<FmaAnalyzeResponse>
analyzePhoto(imageBase64: string): Promise<FmaAnalyzeResponse>
```

Errors bubble with FMA's text. Routes wrap with try/catch.

### Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/food/search?q&limit` | Passthrough to FMA search. No `source` injection. |
| POST | `/api/food/analyze/text` | Passthrough. |
| POST | `/api/food/analyze/photo` | Accept base64; if HEIC, convert via `heic-convert`; forward to FMA. |
| GET | `/api/food/log?date=YYYY-MM-DD` | Today's entries (default = today in `USER_TZ`). |
| POST | `/api/food/log` | Commit batch. Body: `{ logged_at, source, items[] }`. |
| DELETE | `/api/food/log?batch_id=` | Delete whole meal. |
| PATCH | `/api/food/log/:itemId` | Edit grams, rescale macros via per_g rates. |
| GET | `/api/food/log/week` | Mon–Sun aggregates in `USER_TZ`. |
| GET | `/api/food/quick-add` | Top-6 names by 30d frequency. |
| GET | `/api/food/targets` | Current active target. |

## Client architecture

### Provider

`app/_providers/food-log-provider.tsx`. Same shape as `workout-provider.tsx` / `measurements-provider.tsx`. Holds:

```ts
{
  today: MealItem[],
  week: WeekDayAggregate[],
  target: MacroTarget | null,
  quickAdd: { name: string; kcal: number; grams: number }[],
  loading, error,
  addMeal(batch): Promise<void>,
  deleteMeal(batchId): Promise<void>,
  editGrams(itemId, grams): Promise<void>,
  refresh(): Promise<void>
}
```

On mount: fetches all 4 slices in parallel. After mutate: optimistic update + refetch affected slice.

No SWR / TanStack — plain fetch matches existing Hevy pattern.

### `/food` page

Single page, tabbed input, inline review.

```
┌──────────────────────────────────────────────┐
│ Today  ·  1840 / 2200 kcal  ·  4 meals       │
│ 07:12  Oats + whey      620 kcal  [✏] [🗑]   │
│ 12:45  Chicken bowl     880 kcal  [✏] [🗑]   │
├──────────────────────────────────────────────┤
│ [ Search ] [ Type ] [ Snap ]   ← ?mode=     │
│                                               │
│ [ input area for selected tab ]              │
│                                               │
│ Date/time: [now ▼]                           │
│                                               │
│ ── Review ─────────────────────────────────  │
│ ☑ Egg, fried      50g    74 kcal  [conf 0.92]│
│ ☑ Banana, raw    120g   107 kcal  ⚠ low     │
│   ▾ rationale: matched on…                   │
│                                               │
│                              [ Add to log ]  │
└──────────────────────────────────────────────┘
```

- Tabs deep-link via `?mode=search|text|snap`. MealCard buttons set the mode.
- Date default per source: now (text/search) or EXIF (photo). Inline picker.
- Low-confidence pill when `confidence < 0.7`.
- FMA `warnings[]` rendered red inline.
- `rationale` collapsed behind chevron.
- Commit never blocked.

### Dashboard wiring

`CalorieSummary` subscribes to `useFoodLog()`. Week stack: Mon–Sun current week in `USER_TZ`. Future days = empty/planned bars. Target lines (P / P+C / P+C+F) from active `macro_target`. Today's meals from same context.

### Quick-add

```sql
SELECT name, MAX(grams) AS last_grams, AVG(kcal) AS avg_kcal
FROM food_log_entry
WHERE logged_at > now() - interval '30 days'
GROUP BY name
ORDER BY COUNT(*) DESC
LIMIT 6
```

Click chip → opens Search tab with name prefilled; if last grams known, one-tap commit.

## Env additions (`.env.local`)

```
FMA_BASE_URL=http://localhost:3030
FMA_API_KEY=fma_live_xxx
USER_TZ=Australia/Brisbane
DATABASE_URL=postgres://workout:workout@localhost:5433/workout
```

## Migrations & seed

npm scripts:

```
db:up        docker compose up -d db
db:down      docker compose down
db:generate  drizzle-kit generate
db:migrate   drizzle-kit migrate
db:seed      tsx scripts/seed-food.ts
db:reset     down + volume rm + up + migrate + seed
```

Initial migration: tables + indexes (`food_log_entry.logged_at`, `food_log_entry.batch_id`, `macro_target.start_date`).

Seed: one row in `macro_target` representing current period.

## Error handling

- Each route: try/catch → `{ error: string }` with passthrough status.
- UI: banner above review list. No retries, no `/healthz` polling, no circuit breaker.

## Gotchas

- **Timezone.** Aggregation MUST go through `date_trunc('day', logged_at AT TIME ZONE :USER_TZ)`. UTC group-by breaks day boundaries for AU users.
- **HEIC photo.** Server route converts HEIC → JPEG before forwarding base64 to FMA (FMA does not accept HEIC).
- **EXIF date.** Extract from photo buffer on server; pass back to client to populate `logged_at` picker.
- **Per-gram rates.** Must be set at commit time. Editing grams of a row that lacks them → fall back to re-fetch FMA by `fma_source:fma_source_id`.
- **FMA bearer key.** Server-only via `process.env.FMA_API_KEY`. Never reaches client.
- **Drizzle + Next.js.** DB connection lives in `lib/food/db.ts` with `import 'server-only'`. Don't import from any client component.
