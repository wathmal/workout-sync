# CLAUDE.md

Guidance for Claude Code when working in this repo. Architecture details live in `docs/architecture.md`, `docs/food-macro-integration.md`, and `docs/hevy-food-alignment.md` — this file captures the high-level layout and gotchas.

## Commands

```bash
npm run dev                       # Next.js dev server (http://localhost:3000)
npm run build                     # production build (prebuild refreshes Hevy catalog + embeddings)
npm run lint                      # ESLint
npm test                          # Jest, all suites
npm run test:watch                # Jest watch mode
npx jest path/to/file.test.ts     # single test file
npx jest -t "test name pattern"   # filter by test name

# Database (food log)
npm run db:up                     # start local Postgres (docker compose, :5433)
npm run db:down                   # stop
npm run db:generate               # drizzle-kit generate (after schema edits)
npm run db:migrate                # apply migrations
npm run db:seed                   # seed default macro target
npm run db:reset                  # nuke volume + remigrate + reseed

# Hevy catalog + embeddings
npm run refresh:hevy              # repaginate exercise templates → catalog.json
npm run build:embeddings          # build embedding catalog (auto provider)
npm run build:embeddings:both     # build LM Studio + Transformers.js catalogs
npm run build:embeddings:check    # exit 0 if catalogs up-to-date

# E2E (slow, hits real APIs)
npm run e2e:matching              # matching only
npm run e2e:full                  # Groq + matching (needs GROQ_API_KEY)
npm run e2e:heic                  # HEIC convert + Groq (needs GROQ_API_KEY)

# Debug
npm run debug:match -- "DB Curl"  # score breakdown for one query

# Agent harness (feature-flagged tool-use loop)
AGENT_HARNESS_PROVIDER=groq       npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
AGENT_HARNESS_PROVIDER=lm-studio  npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
AGENT_HARNESS_PROVIDER=claude-cli npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
AGENT_DEBUG_LOG=1 ...             # writes JSONL trace to .agent-runs/
```

`npm run dev` reads `.env.local`. Required keys:
- `GROQ_API_KEY` — without it, workout extraction falls back to mock data (yellow banner).
- `HEVY_API_KEY` — needed for sync + catalog refresh.
- `DATABASE_URL`, `FMA_BASE_URL`, `FMA_API_KEY`, `USER_TZ` — needed for the food log.
- `GARMIN_TOKEN_B64`, `GOOGLE_SA_KEY`, `GCAL_ID`, `AGENDA_SYNC_SECRET` — dashboard agenda (Garmin + Calendar). Optional; without them the agenda just shows Hevy + an empty planned side. `GARMIN_TOKEN_B64` is minted by `scripts/garmin/bootstrap.py` (env-only, no volume). See `docs/agenda-integration.md`.

## Architecture

Two domains share the app shell: **Hevy workout sync** and **food/macro log**. They have symmetric provider shapes but different sources of truth (Hevy is SOT for workouts; local Postgres is SOT for food). The dashboard reads from both providers.

### Pipelines

**Workout.** Upload (`/upload`) → `/api/process-workout` (`lib/vision/extractWorkout`) → fuzzy + embedding match against Hevy catalog → review/edit (`/review`) → `useHevy().commitWorkout()` → `/api/hevy-sync` → Hevy API. EXIF date extracted from image, manual override available. `/sync` route was collapsed into `/review`.

**Food.** Input (`/food`, search/text/photo/barcode tabs) → `/api/food/{search,analyze/text,analyze/photo,analyze/barcode,analyze/barcode-photo}` → FMA → review/edit → `POST /api/food/log` (Postgres). `food-log-provider` re-fetches today + week + targets + quickAdd. `CalorieSummary` reads from it.

**Vision abstraction (`lib/vision/`).** Wraps single-shot Groq, single-shot LM Studio, and the agent harness behind one `extractWorkout(buffer, mime, filename, base64)` API. HEIC normalization + EXIF extraction happen here. `ExtractionResult` is shared by the API route regardless of which provider ran.

**Agent harness alt path.** When `AGENT_HARNESS_PROVIDER` ∈ `{groq, lm-studio, claude-cli}`, the vision layer swaps the single-shot call for a tool-use loop (`searchCatalog` / `getExerciseDetails` / `expandAbbreviations` / terminal `proposeWorkout`). Default `off`. Response shape stays byte-compatible. Full details: `docs/architecture.md` § Agent harness.

### Directory layout

**`app/`**
- `dashboard/` — main dashboard page (muscle coverage, calorie summary, body card, race timeline, weekly agenda)
- `upload/`, `review/` — Hevy sync flow (review absorbed the old `/sync`)
- `food/` — food log page (tabbed input, review, today/week summary)
- `_providers/` — `workout-provider` (in-flight upload→review state), `hevy-provider` (persistent reads + commit), `food-log-provider` (today/week/target/quickAdd + mutators), `measurements-provider`, `food-locale.ts`
- `_components/` — shared shell pieces (top nav, footer, viewport guard, etc.)
- `api/process-workout/`, `api/hevy-sync/`, `api/hevy-user/`, `api/hevy-workouts/` — Hevy routes
- `api/food/{search,analyze/{text,photo,barcode,barcode-photo},log,quick-add,targets}/` — food routes

**`lib/`**
- `vision/` — `extractWorkout` entry point + `normalize.ts` (HEIC/EXIF) + `single-shot.ts` (Groq / LM Studio) + `errors.ts`
- `hevy/` — Hevy API client, catalog (`lib/data/hevy-exercises/catalog.json`), fuzzy matcher. `fuzzy-match.ts` is exercise-name-specific (knows abbreviations, equipment ordering) — not a generic string utility.
- `groq/` — Groq client helpers + extraction prompts (used by `lib/vision/single-shot.ts`)
- `embeddings/` — pluggable provider system (LM Studio / Transformers.js). Server-only — lazy-imported by `lib/hevy/exercises.ts` so client bundles stay clean. Pre-computed catalogs in `lib/data/exercise-embeddings/`.
- `agents/` — tool-use harness (feature-flagged). `tools.ts` is the single source of truth for tool defs; `match-loop.ts` drives the iterative path; `providers/{claude-cli,groq,lm-studio}.ts` are adapters.
- `food/` — `schema.ts` (Drizzle), `db.ts` (server-only pool), `fma.ts` (FMA fetch wrapper), `queries.ts` (typed read/write), `targets.ts` (resolve active target), `types.ts`, `photo-prep.ts` (HEIC convert + EXIF for food photos).
- `dashboard/` — `muscle-coverage.ts` (pure compute, used by `hevy-provider`), `muscle-svg-loader.ts`, `mock-data.ts`, `config.ts`.
- `body/` — `measurements.ts` (Hevy body-measurements payload shape, 1:1 with Hevy's API).
- `workout-set-builder.ts` — shared switch over `Exercise.type` → `WorkoutSet`. Used by both `lib/groq/helpers.ts` (single-shot path) and `lib/agents/tools.ts` (agent path). Don't reimplement set-shape conversion.
- `data/` — static data (Hevy catalog snapshot, embedding catalogs).
- `mock-data.ts` — mixed: fixtures + live workout helpers (`calculateWorkoutMetrics`, `formatVolume`). Known smell, split planned.
- `types.ts`, `utils.ts`, `image-utils.ts`, `exercise-abbreviations.ts`, `upload-utils.ts` — shared utilities.

**`drizzle/`** — generated migration SQL + `meta/`. Run `npm run db:generate` after schema changes.

3D body visualisation is not in repo. Future candidate model: https://github.com/datar-psa/clad-body

### Matching scoring
Threshold ≥60. Levenshtein base (0-100) + word overlap (+10 per match) + same starting word (+20) + equipment match (+15) + official bonus (+5). Max 150. Vector mode (cosine) blends with fuzzy via env vars `MATCHING_MODE` (`fuzzy|vector|both`) and `EMBEDDING_SOURCE` (`lm-studio|transformers|auto|off`). Abbreviation expansion: `BB→barbell, DB→dumbbell, KB→kettlebell, EZ→ez bar, SZ→sz bar, Swiss→swiss bar, Trap→trap bar`. Equipment word reordered to end so "DB Curl" matches "Bicep Curl (Dumbbell)".

### Tests
Unit tests colocated (`lib/foo.test.ts` next to `lib/foo.ts`). E2E in `tests/e2e/`. Ad-hoc scripts in `scripts/`. Agent harness tests in `lib/agents/__tests__/`.

### State
- `workout-provider.tsx` — in-flight upload → review state (image, parsed exercises, sync prefs). Page-local.
- `hevy-provider.tsx` — persistent reads (last 14 days) + computed muscle coverage + `commitWorkout()`. Symmetric to food provider.
- `food-log-provider.tsx` — today + week + active target + quickAdd + mutators (`addMeal`, `deleteMeal`, `editGrams`).
- `measurements-provider.tsx` — Hevy body-measurement state.

### API routes
All server-side only — API keys never reach client.
- Hevy: `app/api/process-workout/`, `app/api/hevy-sync/`, `app/api/hevy-workouts/` (used by `hevy-provider` for last-14d + dup detection), `app/api/hevy-user/`.
- Food: `app/api/food/search/`, `app/api/food/analyze/{text,photo,barcode,barcode-photo}/`, `app/api/food/log/` (GET today, POST commit, DELETE batch; `[itemId]/` PATCH grams; `week/` aggregates), `app/api/food/quick-add/`, `app/api/food/targets/`.

## Gotchas

- **Next.js client/server split.** `lib/hevy/exercises.ts` lazy-imports embedding code (`@huggingface/transformers`, `fs`). Don't break this — adding a top-level import will pull Node-only deps into client bundle and break build. Same rule applies to `lib/food/db.ts` (Postgres pool) — must stay `import "server-only"`.
- **Mock fallback detection** uses string match: `exercises[0].title === "Push Press"`. Fragile. If you change mock fixture exercises, update the check (or replace with explicit flag).
- **Path alias** `@/*` maps to repo root (see `tsconfig.json`). Use `@/lib/...` from app/components, `../lib/...` from scripts/tests.
- **Tailwind v4** uses CSS variables under `@theme` directive in `app/globals.css`. shadcn config (`components.json`) targets New York style.
- **Jest picks up `.next/standalone/lib/*.test.ts`** build artifacts — duplicates of real tests. Add `testPathIgnorePatterns: ['/node_modules/', '/.next/']` to `jest.config.js` if cleaning up.
- **Image limits**: ≤20MB, ≤33 megapixels (Groq), base64 request ≤4MB.
- **HEIC/HEIF**: accepted on upload, converted server-side via `heic-convert` before forwarding to Groq or FMA. EXIF runs on the original buffer (exifr supports HEIC). Workout flow returns the converted JPEG as `convertedImageBase64`; client swaps it into context so the review-page preview renders. Detection uses mime + filename extension + ISO BMFF brand bytes (iOS Safari often reports empty `file.type`). Food path has its own helper at `lib/food/photo-prep.ts`.
- **Hevy sync** is sequential per exercise (~1.5s each) — UI animates progress.
- **E2E fixtures** in `tests/fixtures/`: `workout-revl-1.jpeg` (full-e2e), `workout-revl-2.heic` (heic-e2e).
- **`server-only` + tsx**: scripts that import server-marked modules (prompts, embeddings, hevy/api, food/db) must run with `NODE_OPTIONS=--conditions=react-server` so the package resolves to its empty.js entry instead of the throwing default. All `npm run` scripts already set this — only matters if you invoke `tsx` directly.
- **`prebuild` refreshes the Hevy catalog when possible.** `npm run build` triggers `npm run refresh:hevy`, which paginates `GET /v1/exercise_templates` and rewrites `lib/data/hevy-exercises/catalog.json`. Soft-fails when `HEVY_API_KEY` is missing — the script warns and continues with the catalog already committed in the repo. Embeddings rebuild only when the catalog's exerciseId set changes (`--check-or-rebuild` skips otherwise).
- **Food timezone.** Day-boundary aggregation in `/api/food/log` + `/api/food/log/week` MUST use `date_trunc('day', logged_at AT TIME ZONE :USER_TZ)`. UTC group-by breaks day boundaries for AU users.
- **Food edit-grams.** Per-gram rates (`kcal_per_g`, etc.) are stored at commit time so edits rescale locally without re-querying FMA. Don't drop those columns.
- **Macro target overlap.** Disallowed by policy — inserting a new period auto-closes the prior by setting `prior.end_date = new.start_date - 1`. Always exactly one active target.
- **Hevy dup detection** is a pure date-filter against `useHevy().workouts` (last 14d). Don't reintroduce a raw API call inside `/review`.
- **Provider roles.** `workout-provider` = in-flight UI state. `hevy-provider` = persistent reads + commit. `food-log-provider` = persistent reads + mutators. `agenda-provider` = reads `/api/agenda` (merged week) + `sync()` (server action). Don't mix sync state into `workout-provider` again — it was extracted on purpose.
- **Dashboard agenda.** Merge is the pure `buildAgenda()` in `lib/dashboard/agenda.ts` (unit-tested) — keep it pure (no DB/clock/network; `now`+`tz` injected). Garmin runs as a Python subprocess (`scripts/garmin/fetch.py`); its **stdout must stay clean JSON** (logging + login prints forced to stderr — same rule as the agent CLI shims) and the script dir must be **COPYed into the Docker runner** (Next standalone output excludes it). Manual sync = same-origin server action (`app/_actions/agenda.ts`, no secret); cron = `POST /api/agenda/sync` with `x-sync-secret`. Full design: `docs/agenda-integration.md`.
- **Agent harness — tool schemas defined ONCE.** Edit `lib/agents/tools.ts` `AGENT_TOOLS`. Adapters consume per-provider shape via `toOpenAITools()` / `toAnthropicTools()` / `toCliBashAllowlist()`. Don't duplicate schema in adapters. If you add a tool, also add a CLI shim in `scripts/agent-tools/<name>.ts` (one-line `runShim("toolName")`) and extend the `--allowedTools` list in `lib/agents/providers/claude-cli.ts`.
- **Agent harness — CLI shim stdout MUST stay clean JSON.** Each shim imports `./_silence` first to redirect `console.log` (catalog boot prints) to stderr. Don't add `console.log` to anything in the shim's import path or you'll break the parent's JSON parse.
- **Agent harness — Vercel deploy + `claude-cli`.** `claude` binary isn't in serverless runtimes. `claude-cli` provider is local-dev / self-hosted only. Production deploys should use `groq` or stay `off`.
- **Agent harness — local model tool calling varies.** Some LM Studio models (e.g. `nvidia/nemotron-3-nano-omni`) emit XML-style tool calls inside `reasoning_content` instead of populating `tool_calls`. `lib/agents/providers/openai-shape.ts` parses both. If a new model fails with `finishReason: stop, toolCalls: 0`, check whether output is going to `reasoning_content` and extend the parser, or pin a different model via `LM_STUDIO_AGENT_MODEL`.
- **Agent harness — Groq's strict tool-arg validator.** Groq rejects requests where the model's tool args have keys not in the schema (`additionalProperties: false`). The set-object schema is intentionally `additionalProperties: true` because Llama models sometimes copy `type` or `weight_reps` onto each set; our handler only reads known fields so extras are silently ignored. Don't tighten this.

## When extending

- **New API route:** drop in `app/api/<name>/route.ts`. Server-only secrets read via `process.env`.
- **New shadcn component:** `npx shadcn@latest add <name>` — installs to `components/ui/`.
- **New lib module:** pick a domain (`vision/`, `hevy/`, `groq/`, `embeddings/`, `agents/`, `food/`, `dashboard/`, `body/`) or place at `lib/` root if cross-cutting. Don't recreate sibling utils already in `lib/utils.ts` or `lib/agents/env.ts`.
- **Touching matching:** regenerate embeddings (`npm run build:embeddings:both`) if exercise catalog JSON files change. Run `npm run debug:match -- "<input>"` to inspect score components.
- **New agent provider:** implement `IterativeAgentProvider` (or `SelfHostedAgentProvider`) from `lib/agents/types.ts`; add a `case` in `lib/agents/index.ts:buildProvider`; extend `AgentProviderName` union + `getAgentHarnessProvider()` validation. OpenAI-compat providers reuse `createOpenAIShapeSession()` — pass baseUrl/model/auth.
- **New agent tool:** add to `AGENT_TOOLS` in `lib/agents/tools.ts` (handler + JSON Schema). Add CLI shim at `scripts/agent-tools/<name>.ts`. Extend `--allowedTools` list in `claude-cli.ts`. Mention the tool in `AGENT_SYSTEM_PROMPT` + `AGENT_SYSTEM_PROMPT_CLI` workflow contract.
- **New food schema field:** edit `lib/food/schema.ts`, run `npm run db:generate`, commit the generated SQL under `drizzle/`, then `npm run db:migrate` locally.
- **New dashboard widget:** add under `components/dashboard/`, wire to whichever provider owns the data. Don't add new RSC fetches at `app/page.tsx` — the alignment pass made it a sync shell that reads from providers.
