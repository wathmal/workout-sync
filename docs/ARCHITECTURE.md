# Architecture

Single source of truth. Code is canonical — this doc only captures what code can't tell you.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict
- Tailwind v4 (CSS variables in `:root`, mapped via `@theme` directive — required for v4)
- shadcn/ui (New York style), Radix primitives, lucide-react
- State: React Context (`app/_providers/workout-provider.tsx`)
- Tests: Jest + ts-jest. `*.test.ts` colocated with source. E2E in `tests/e2e/`.
- Container: multi-stage Dockerfile, standalone output, runs as `nextjs:nodejs` (UID/GID 1001)

## Data flow

```
upload → /api/process-workout (Groq) → fuzzy + embedding match (Hevy catalog)
       → review (edit) → /api/hevy-sync → Hevy API
```

EXIF date extracted from image; falls back to manual pick.

## Directory layout

```
app/
  api/
    process-workout/   POST: image → Groq → exercises[]
    hevy-sync/         POST: workout → Hevy API
    hevy-workouts/     GET: list workouts (duplicate detection)
  page.tsx             landing
  upload/, review/, sync/
components/
  ui/                  shadcn primitives only
  *.tsx                custom workout components
contexts/
  WorkoutContext.tsx   global workout state
lib/
  hevy/                api.ts, exercises.ts, fuzzy-match.ts (+ test)
  groq/                helpers.ts, prompts.ts
  embeddings/          pluggable provider system (LM Studio / Transformers.js)
  data/
    hevy-exercises/    5 JSON snapshots merged at startup
    exercise-embeddings/ pre-computed catalogs (built via script)
  mock-data.ts         fixtures + workout helpers (mixed concerns — split later)
  types.ts, utils.ts, image-utils.ts
scripts/               build/debug tooling (build:embeddings etc.)
tests/e2e/             slow, hits real APIs
```

## Hevy integration

- Endpoint: `POST https://api.hevyapp.com/v1/workouts`, Bearer auth
- Env: `HEVY_API_KEY` (server-only, `.env.local`, gitignored)
- Transform: `Workout` → `{ start_time (ISO), end_time (start + duration_minutes), exercises: [{ exercise_template_id, sets }] }`
- Validation before submit: date present, ≥1 exercise w/ valid Hevy ID, ≥1 set with `kg>0` or `reps>0`
- Status handling: 401 unauthorized, 400 bad request, 429 rate limit, 5xx service unavailable
- Sync runs sequentially, ~1.5s per exercise (animated progress)
- Duplicate detection: `GET /workouts` filtered by date

## Groq vision

- Model: `meta-llama/llama-4-scout-17b-16e-instruct` (preview)
- Env: `GROQ_API_KEY` (server-only)
- Limits: image ≤20MB, ≤33 megapixels; base64 request ≤4MB
- Accepted formats: JPEG, PNG, WEBP. HEIC/HEIF accepted on upload but converted server-side to JPEG via `heic-convert` (`lib/image-utils.ts`) before forwarding to Groq. EXIF runs on the original HEIC buffer first (exifr supports HEIC). Detection: mime + filename extension + ISO BMFF brand bytes — iOS Safari frequently reports empty `file.type` for HEIC. Server returns the converted JPEG as `convertedImageBase64`; client rebuilds a `File` and swaps it into the workout context so review-page preview renders.
- Prompts: `lib/groq/prompts.ts` (`WORKOUT_EXTRACTION_SYSTEM_PROMPT`, `..._USER_PROMPT`)
- Response: JSON `{ exercises: [{ name, sets: [{ kg, reps }] }] }`
- Fallback: returns mock data if key missing / network error / rate limit. UI shows yellow warning banner. Detection: `exercises[0].title === "Push Press"` (mock indicator — fragile, replace with explicit flag).

## Exercise matching

Catalog: 453 exercises (429 official + 24 custom), merged from 5 JSON snapshots.

**Fuzzy score** (max 150, threshold ≥60):
- Levenshtein-based similarity (0-100)
- Word overlap: +10 per matched word
- Same starting word: +20
- Equipment match: +15
- Official (non-custom): +5

**Normalization pipeline** (`lib/hevy/fuzzy-match.ts`):
1. Lowercase + trim
2. Expand abbreviations: `BB→barbell, DB→dumbbell, KB→kettlebell, EZ→ez bar, SZ→sz bar, Swiss→swiss bar, Trap→trap bar`
3. Reorder equipment word to end (so "DB Curl" matches "Bicep Curl (Dumbbell)")
4. Slash handling: `BB/DB Curl` takes first option (`BB Curl`)

**Vector mode** (optional): cosine similarity against pre-built embedding catalogs. Blended with fuzzy score. Configured via `MATCHING_MODE` (`fuzzy|vector|both`) and `EMBEDDING_SOURCE` (`lm-studio|transformers|auto|off`). Build catalogs: `npm run build:embeddings:both`. Server-only — lazy-imported in `hevy/exercises.ts` so client bundle stays clean.

## Error handling

| Type | Trigger | UI |
|------|---------|-----|
| Hard error | Bad file type, file >20MB | Red banner, no fallback |
| Soft error | API key missing, network fail, rate limit | Yellow banner, mock fallback |

Banner classes: red = `bg-red-50 border-red-200`, yellow = `bg-yellow-50 border-yellow-200`.

## Testing

- `npm test` — Jest, all suites
- `npm run test:watch` — watch mode
- E2E: `tsx tests/e2e/test-matching-e2e.ts` (matching only), `tsx tests/e2e/full-e2e.ts` (Groq + matching, needs `GROQ_API_KEY`)
- Manual debug: `tsx scripts/debug-match.ts "DB Curl"` — prints score breakdown
- **Known issue:** Jest also picks up `.next/standalone/lib/*.test.ts` build artifacts. Add `testPathIgnorePatterns: ['/node_modules/', '/.next/']` to `jest.config.js`.

## Deployment

### Docker
Multi-stage build (Node 22 alpine). Detects package manager from lockfile. Final image ~150-200MB. Runtime memory: ~100-200MB idle, up to 500MB under load. Embedding catalogs (`lib/data/exercise-embeddings/*.bin`) are pulled into the standalone trace via `outputFileTracingIncludes` in `next.config.ts` — they're loaded via `fs` so wouldn't be traced automatically.

```bash
podman build -t workout-sync:latest .
podman buildx build --platform linux/amd64 -t workout-sync:amd64 .
podman run -d -p 3000:3000 \
  -e HEVY_API_KEY=... -e GROQ_API_KEY=... \
  --restart unless-stopped workout-sync:latest
```

### Runtime env vars

| Var | Required | Default in image | Purpose |
|-----|----------|------------------|---------|
| `HEVY_API_KEY` | yes | — | Hevy sync |
| `GROQ_API_KEY` | yes (no fallback to mock) | — | Vision extraction |
| `MATCHING_MODE` | no | `fuzzy` | `fuzzy` / `vector` / `both` |
| `EMBEDDING_SOURCE` | no | `off` | `auto` / `lm-studio` / `transformers` / `off` |
| `EMBEDDING_BOOST_MAX` | no | `30` | Max additive embedding boost in `both` mode |
| `EMBEDDING_COS_THRESHOLD` | no | `0.55` | Cosine score below this contributes 0 boost |

Container ships with embeddings disabled. To enable:

- **Transformers in-container** (~280MB model download on first request):
  ```bash
  -e MATCHING_MODE=both -e EMBEDDING_SOURCE=transformers \
  -v hf-cache:/home/nextjs/.cache/huggingface
  ```
  Without the volume the model re-downloads every container start.
- **External LM Studio** (no in-container model):
  ```bash
  -e MATCHING_MODE=both -e EMBEDDING_SOURCE=lm-studio \
  -e LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1 \
  -e LM_STUDIO_EMBEDDING_MODEL=text-embedding-qwen3-embedding-8b
  ```

### TrueNAS Scale
Apps → Custom App → Install. Set image repo, env vars (see table), port mapping (container 3000). Configure Docker Hub creds for private repos.

Or load image directly: `docker load -i image.tar`.

## Security

- Both API keys server-only. Never sent to client. Validated before use.
- `.env.local`, `.env.*.local` gitignored.
- `.idea/`, `.continue/`, `.cursor/` should be added to `.gitignore` (currently leak).

## UI conventions

- Mobile-first, min 44px touch targets, iOS safe-area padding
- Date format: `MMM dd` (date-fns). Time format: `HH:MM`, default `08:00`.
- Image zoom/pan: `react-zoom-pan-pinch` v3, range 50%-400%, 30% step, double-click resets. Desktop only (`hidden lg:block`).
- Dark mode: toggle `dark` class on `<html>`. CSS vars switch automatically.

## Open tech debt

- `lib/mock-data.ts` mixes fixtures + real helpers. Split: real → `lib/workout.ts`, fixtures → `tests/fixtures/`.
- Mock-fallback detected by string match (`title === "Push Press"`). Replace with explicit `isMock` flag.
- No `.nvmrc` despite Node 22+ requirement.
