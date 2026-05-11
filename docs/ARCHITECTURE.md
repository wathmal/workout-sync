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

When `AGENT_HARNESS_PROVIDER` is not `off`, `/api/process-workout` swaps the single-shot Groq call + post-hoc match for an iterative tool-use loop (see *Agent harness*). Response shape is byte-compatible — downstream review/sync flow is unchanged.

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
  agents/              tool-use harness (feature-flagged extraction path)
    providers/         claude-cli / groq / lm-studio adapters + openai-shape
    __tests__/
  data/
    hevy-exercises/    Hevy template catalog (refreshed by prebuild)
    exercise-embeddings/ pre-computed catalogs (built via script)
  mock-data.ts         fixtures + workout helpers (mixed concerns — split later)
  workout-set-builder.ts  shared switch over Exercise.type (used by groq + agents paths)
  types.ts, utils.ts, image-utils.ts
scripts/               build/debug tooling (build:embeddings etc.)
  agent-tools/         CLI shims invoked by claude-cli adapter
  agent-extract.ts     manual try-it for the agent harness
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

## Agent harness

Feature-flagged alternative to single-shot Groq vision. When `AGENT_HARNESS_PROVIDER` is set to anything other than `off`, `/api/process-workout` routes through a tool-use loop instead of the single-shot path. Default `off` — existing behavior unchanged.

**Why.** Single-shot vision misroutes ambiguous rows (compound exercises, unusual abbreviations, mixed equipment). The agent iterates: search the catalog, narrow candidates, verify equipment/type, then commit a final `WorkoutExercise[]` via the terminal `proposeWorkout` tool.

**Providers (v1).**
- `claude-cli` — spawns `claude -p` subprocess. Highest accuracy. ~3-6 min/run, ~$0.30-0.50 (Opus). Self-hosted-loop kind: claude drives its own internal loop; the adapter parses `--output-format stream-json` events and derives the agent tool name from `Bash(npx tsx scripts/agent-tools/<name>.ts ...)` commands. Tool shims write the final workout to a tmp sentinel JSON. Production deploys without the `claude` binary won't work — local-dev / self-hosted only.
- `groq` — Llama 4 Scout via OpenAI-compat `chat.completions` with `tools`. ~30-60s/run, <$0.001. `tool_choice: required` to suppress prose drift. 429 handler honors `Retry-After` header and Groq's "try again in Xs" body hint, with exponential backoff fallback (default 3 retries, capped at 60s wait).
- `lm-studio` — OpenAI-compat at `LM_STUDIO_URL` (default `http://localhost:1234/v1`). Default model `nvidia/nemotron-3-nano-omni`. Some local models emit XML-style tool calls (`<tool_call><function=NAME><parameter=KEY>VALUE</parameter></function></tool_call>`) inside `reasoning_content` instead of `tool_calls`; the adapter parses those and synthesizes OpenAI-shape calls.

**Tools.** Defined once in `lib/agents/tools.ts`. `toOpenAITools()` / `toAnthropicTools()` / `toCliBashAllowlist()` derive per-provider shape from a single source of truth.
- `searchCatalog(query, limit?, kind?)` — wraps `searchExercisesScored()`
- `getExerciseDetails(id)` — wraps `getHevyTemplateById()` (id-keyed Map, O(1))
- `expandAbbreviations(text)` — wraps `expandAbbreviations` from `lib/exercise-abbreviations.ts`
- `proposeWorkout(exercises[])` — terminal. Validates id + set-shape against `Exercise.type`, returns `WorkoutExercise[]` shaped identically to `parseGroqResponse` output via shared `lib/workout-set-builder.ts`.

**Loop control** (`lib/agents/match-loop.ts`):
- `AGENT_MAX_ITERATIONS` (default 30) hard cap; throws `AgentLoopError("max_iterations")` on exceed.
- 3 consecutive `proposeWorkout` validation failures → `AgentLoopError("propose_validation_failed")`.
- Unknown tool name / malformed args returned to model as `{ ok: false, error }` so it can self-correct.
- 429s on iterative providers transparently retried inside `openai-shape.ts` — they don't count toward the iteration cap.

**Telemetry** (`lib/agents/telemetry.ts`). Logs per-turn + per-tool-call to console with `[agent:<runId>]` prefix:
```
[agent:moz0...] turn 0 tool_use toolCalls=1
[agent:moz0...] → searchCatalog({"query":"barbell bench press","limit":5})
[agent:moz0...] ← searchCatalog ok: 5 results
```
`AGENT_DEBUG_LOG=1` additionally appends JSONL events to `.agent-runs/<runId>.jsonl` (gitignored). The `finalize()` summary string becomes the API response's `raw_response` so the existing UI raw-response panel keeps working.

**CLI shims** (`scripts/agent-tools/`). Each tool has a thin wrapper script callable as `npx tsx scripts/agent-tools/<name>.ts '<json>'`. The shim reads `argv[2]`, dispatches via `dispatchTool`, prints the result JSON to stdout. `_silence.ts` redirects `console.log` (catalog boot prints) to stderr so stdout stays clean for the parent's JSON parse. `propose-workout.ts` additionally writes the assembled workout to `AGENT_RESULT_PATH` for the claude-cli adapter to read post-exit.

**Response shape.** Agent path returns the same envelope as the single-shot path (`exercises`, `modelName`, `confidence`, `extractedDate`, `raw_response`, `convertedImageBase64`). `app/_providers/workout-provider.tsx` consumers don't change. `modelName` reflects the active provider, e.g. `"Llama 4 Scout · Groq (agent)"`.

**Manual try-it.**
```bash
AGENT_HARNESS_PROVIDER=groq      npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
AGENT_HARNESS_PROVIDER=lm-studio npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
AGENT_HARNESS_PROVIDER=claude-cli npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg

# Forensic JSONL trace
AGENT_DEBUG_LOG=1 AGENT_HARNESS_PROVIDER=groq npm run agent:extract -- tests/fixtures/workout-revl-1.jpeg
```

## Exercise matching

Catalog: 459 exercises (433 official + 26 custom), refreshed from the Hevy API on every `prebuild`.

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
| `AGENT_HARNESS_PROVIDER` | no | `off` | `off` / `groq` / `lm-studio` / `claude-cli`. When non-`off`, replaces single-shot extraction with tool-use loop |
| `AGENT_MAX_ITERATIONS` | no | `30` | Loop turn cap (also `--max-turns` for `claude-cli`) |
| `AGENT_TIMEOUT_MS` | no | `240000` | Subprocess kill timeout (`claude-cli` only) |
| `AGENT_DEBUG_LOG` | no | unset | `=1` writes JSONL traces to `.agent-runs/` |
| `GROQ_AGENT_MODEL` | no | `meta-llama/llama-4-scout-17b-16e-instruct` | Override Groq model |
| `LM_STUDIO_AGENT_MODEL` | no | `nvidia/nemotron-3-nano-omni` | Override LM Studio model |
| `LM_STUDIO_MAX_TOKENS` | no | `8192` | Local model token budget |
| `LM_STUDIO_TEMPERATURE` | no | `0.1` | Local model temperature |
| `CLAUDE_CLI_BIN` | no | `claude` | Override CLI binary path (claude-cli adapter) |

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
