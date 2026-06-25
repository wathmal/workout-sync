# Fitness Trends + Hyrox Predictor

Design + build plan for tracking long-term fitness trend (VO2max, running fitness,
resting HR, a composite index) from Garmin, plus a live Hyrox race-time predictor
that rides on the same fitness signal.

Status: **planned, not built.** Scope below is confirmed against the live Garmin
account (see [Spike findings](#spike-findings)), not assumed.

Related: [agenda-integration.md](./agenda-integration.md) (the Garmin subprocess +
upsert pipeline this feature clones), [hevy-food-alignment.md](./hevy-food-alignment.md).

---

## Goal

Two dashboard cards:

1. **Fitness Trends** — "is my engine improving or decaying?" A composite index headline
   plus the component trends (VO2max, running fitness / VDOT, resting HR).
2. **Hyrox Predictor** — projected race finish + per-segment breakdown + execution leaks,
   recomputed as fitness moves so the prediction itself trends downward over time.

Both read from a nightly Garmin metrics snapshot stored in Postgres.

---

## Spike findings

Probed the live account with `garminconnect==0.3.6` (the version pinned in
`Dockerfile`). Watch on the account is a **Forerunner 245M** (2019 mid-tier,
deviceId `3369069339`) — predates Garmin's Firstbeat premium metrics, which
explains every gap below.

**Available (real values returned):**

| Metric | Value seen | Source method / path |
|---|---|---|
| VO2max (running) | 51.1 | `get_training_status(d).mostRecentVO2Max.generic.vo2MaxPreciseValue` |
| Race predictions | 5K 21:36 · 10K 46:38 · HM 1:51:48 · M 4:16:23 | `get_race_predictions()` (no args) → `time5K/10K/HalfMarathon/Marathon` (seconds) |
| Training status | code 5, weeklyLoad 300, fitnessTrend 2 | `get_training_status(d).mostRecentTrainingStatus.latestTrainingStatusData[deviceId]` |
| Resting HR | 58 | `get_stats(d).restingHeartRate`, also `get_fitnessage_data(d).components.rhr` |
| Fitness age | 20 (fit) / 33 (chrono) | `get_fitnessage_data(d)` / VO2max block |

**Gated out — hardware, not library (all methods exist in 0.3.6, return null/empty):**

| Metric | Why |
|---|---|
| Lactate threshold | FR245M doesn't measure it. `get_lactate_threshold()` returns a dict with all-null fields. |
| Endurance score | Firstbeat premium; not computed on FR245M. |
| Hill score | Same. |
| ACWR / acute-chronic load | `acuteTrainingLoadDTO: null`. Only `weeklyTrainingLoad` present. |
| HRV status | FR245M has no HRV tracking. |
| Training readiness | Returns `[]`; too old. |
| Running tolerance | Returns `[]`. |

**No `garminconnect` version bump needed** — every method exists in 0.3.6. The gaps
are device capability. Bumping the library would not unlock any of the gated metrics.

**Implications vs the original three asks:**

- **VO2max** → native, ship it.
- **Lactate threshold** → native unavailable. Derive from existing threshold work
  (Z4 HR 158 zone, `scripts/fit/analyze.py` track-threshold sessions) or from race-pred pace.
- **"Engine" / endurance** → native unavailable. **Race predictions are the engine proxy**
  (VDOT blends VO2max + running economy into one performance number).

### Latest-only gotcha

`mostRecentVO2Max` is *latest*, not historical — Garmin returns the most-recent computed
value regardless of the date queried, and FR245M only recomputes VO2max after a qualifying
outdoor run (the sample seen was 9 days stale). The same applies to the standalone
`get_max_metrics` endpoint ([cyberjunky #74](https://github.com/cyberjunky/python-garminconnect/issues/74)).
**Consequence: we must snapshot daily and store our own series — history cannot be backfilled
from the API.** Race predictions update more frequently and are the more responsive trend line.

### DIY VO2max proxy (validated)

The Uth–Sørensen–Overgaard heart-rate-ratio method estimates VO2max from resting + max HR,
needs no special hardware, and runs off the daily RHR feed:

```
VO2max ≈ 15.3 × (HRmax / HRrest)
       = 15.3 × (195 / 58) = 51.4      ← Garmin native: 51.1  (matches)
```

`HRmax = 195` is the athlete's observed sim max (preferred over the Tanaka estimate
`208 − 0.7·age = 185`). The proxy fills the gap on days Garmin's native VO2max is stale —
RHR moves daily, native VO2max does not. Source: Uth et al., *Eur J Appl Physiol* 91:111–115 (2003).

---

## Architecture

Mirrors the existing agenda pipeline exactly — no new infrastructure:

```
cron (nightly) → scripts/garmin/fetch.py --metrics → JSON stdout
              → lib/fitness/sync.ts (upsert) → Postgres
              → lib/fitness/queries.ts → fitness-provider → dashboard cards
compute: pure functions in lib/fitness/*.ts and lib/hyrox/*.ts (no I/O, unit-tested),
         same pattern as lib/dashboard/agenda.ts buildAgenda() and lib/dashboard/muscle-coverage.ts
```

`scripts/garmin/` is already COPYed into the Docker runner (the agenda work added this);
the metrics mode needs no Docker change. Python stays thin — it extracts raw fields only;
all derived values (Uth proxy, composite index, Hyrox projection) are computed in TypeScript.

---

## Database schema

New file `lib/db/schema/fitness.ts` (Drizzle, same conventions as `lib/db/schema/agenda.ts`).
Run `npm run db:generate`, commit the SQL under `drizzle/`, then `npm run db:migrate`.

### `daily_fitness_metric` — one snapshot row per local day (USER_TZ)

```ts
export const dailyFitnessMetric = pgTable("daily_fitness_metric", {
  date: date("date").primaryKey(),                  // YYYY-MM-DD, USER_TZ
  vo2maxRunning: real("vo2max_running"),            // native, e.g. 51.1
  vo2maxComputedDate: date("vo2max_computed_date"), // Garmin's calendarDate — staleness signal
  uthVo2max: real("uth_vo2max"),                    // RHR-derived proxy (daily filler)
  racePred5kS: integer("race_pred_5k_s"),
  racePred10kS: integer("race_pred_10k_s"),
  racePredHmS: integer("race_pred_hm_s"),
  racePredMS: integer("race_pred_m_s"),
  trainingStatusCode: integer("training_status_code"),  // 5
  fitnessTrendCode: integer("fitness_trend_code"),      // 2
  weeklyLoad: integer("weekly_load"),                   // 300
  restingHr: integer("resting_hr"),                     // 58
  fitnessIndex: real("fitness_index"),                  // composite (see compute)
  raw: jsonb("raw"),                                    // full upstream blob, reprocessable
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({ dateIdx: index("dfm_date_idx").on(t.date) }));
```

### `hyrox_station_benchmark` — station times from sims (not daily Garmin)

```ts
export const hyroxStationBenchmark = pgTable("hyrox_station_benchmark", {
  id: serial("id").primaryKey(),
  station: text("station").notNull(),       // ski|sled_push|sled_pull|bbj|row|farmers|lunge|wallball
  timeS: integer("time_s").notNull(),
  weightKg: integer("weight_kg"),           // sleds / carry
  distanceM: integer("distance_m"),
  racePosition: integer("race_position"),   // 1-8 — for fatigue grading
  sourceFit: text("source_fit"),            // e.g. '23061293322_solo_sim.fit'
  measuredAt: timestamp("measured_at", { withTimezone: true }),
  notes: text("notes"),
});
```

### `hyrox_projection` — projection snapshots, so the prediction itself trends

```ts
export const hyroxProjection = pgTable("hyrox_projection", {
  date: date("date").primaryKey(),
  division: text("division").notNull(),          // open | pro
  predictedTotalS: integer("predicted_total_s").notNull(),
  rangeLowS: integer("range_low_s"),
  rangeHighS: integer("range_high_s"),
  runPaceSPerKm: integer("run_pace_s_per_km"),   // engine, derived from race-pred
  segments: jsonb("segments"),                   // 16-segment breakdown
  basis: jsonb("basis"),                         // race-pred + benchmark snapshot used
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

---

## Python: `fetch.py --metrics`

Add a mode to `scripts/garmin/fetch.py` (reuse the existing token-load + DI login +
stderr-silencing — stdout must stay clean JSON). Extract with defensive `.get()`
everywhere (FR245M returns nulls / partial blobs):

```python
ts   = client.get_training_status(today)   # mostRecentVO2Max.generic.vo2MaxPreciseValue + calendarDate
                                           # mostRecentTrainingStatus...{trainingStatus, weeklyTrainingLoad, fitnessTrend}
race = client.get_race_predictions()       # time5K / time10K / timeHalfMarathon / timeMarathon
stat = client.get_stats(today)             # restingHeartRate
```

Emit a single JSON object. **No computation in Python** — the Uth proxy and composite
index are computed in TypeScript so they stay unit-testable and the Python shim stays
a thin extractor (same discipline as the activity path and the agent CLI shims).

`lib/fitness/garmin.ts` spawns the subprocess (clone `lib/agenda/garmin.ts`).

---

## Pure compute — `lib/fitness/`

Unit-tested, no I/O, mirrors `lib/dashboard/agenda.ts`:

```ts
// uth.ts — daily VO2max proxy. maxHr configurable; default 195 (observed), NOT Tanaka.
uthVo2max(restingHr: number, maxHr = 195) => 15.3 * (maxHr / restingHr)

// index.ts — composite fitness index. Needs rolling mean/sd over history → z-scores.
//   raw  = z(vo2max) + z(vdot(racePred10k)) − z(restingHr) + z(weeklyLoad)   (equal weights to start)
//   shown = mapped to 0–100 for a readable headline (see Open decisions)
// Requires ~2–3 weeks of daily snapshots before meaningful → card shows "building…" until then.

// training-status.ts — code → label lookup (0..8: detraining … productive … peaking … strained).
```

VDOT from race predictions uses the Daniels–Gilbert relation (or simply tracks predicted
5K/10K time directly as the performance trend — both are valid; predicted-time is simpler).

---

## Hyrox predictor — `lib/hyrox/predict.ts` (pure)

```
T_total = Σ run_i(basePace, fatigue_i) + Σ station_j(benchmark) + roxzone

basePace   = compromise(racePred10k)   // open ~4:40/km × ~1.30 = ~6:03/km (measured from sims)
fatigue_i  = measured per-round curve: fresh → +11% post-sled → settle (from the two sims)
station_j  = hyrox_station_benchmark, sled times scaled by weight
BBJ        = wide band — the variance bomb (5:43 fresh → 9–11 min under full fatigue)
roxzone    = constant, from sims
```

Seed `hyrox_station_benchmark` from the two existing sims in `data/activities/`:
`23061293322_solo_sim` (29 May, full-weight sleds 152/103, GPS) and
`23323566408_rox_sim_2` (21 Jun, indoor, engine confirmation). Reference projection:
`data/activities/projected_open_solo_race.md` (~1:40, stretch 1:34).

Output: predicted finish + range + 16-segment breakdown + leak flags (sled-pull setup ~2:18,
BBJ pace). **Re-projects whenever race-pred moves** — this is the live link between the
fitness trend and the race number.

Indoor sims have no GPS, so `.fit` auto-segmentation is imperfect (the 21 Jun analysis is
HR-inferred). Station structure (order + weights) is a manual/config input; code computes
times from HR valleys + laps. Semi-automatic, not fully automatic.

---

## Sync wiring

- The nightly cron (`30 21 * * *`, already firing for activities) gains the metrics pull —
  either extend `POST /api/agenda/sync` or add `POST /api/fitness/sync` (same `x-sync-secret`).
- The Hyrox projection is recomputed in the same job (cheap, pure) and a snapshot row written.

---

## UI

Dashboard is `app/page.tsx` (desktop) / `MobileOverview` (mobile shell). Max content width
1400px, inner **1336px** (`maxWidth 1400 − 2 × --space-2xl(32)`), grid gaps `--space-xl` (24px).
Voqi yellow accent on the index number, trend arrows, and run bars; stations dimmed.

### Locked layout

- **ManualLog is hidden** (conditional render; restore = flip the flag). Removes the
  dashboard's manual log shortcut for now.
- **Fitness Trends** takes the freed ManualLog slot in row 1 (`5fr 3fr 4fr` → **429px**).
- **Hyrox Predictor** gets its own row at **half width (656px)**, left-aligned; right half reserved.

```
┌────────────────────── inner 1336 ──────────────────────┐
│ ┌─ Weekly Agenda ──────────────── full 1336 ─────────┐ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌ Calorie 537 ┐ ┌ Muscle 322 ┐ ┌ FITNESS 429 ┐ 5/3/4   │  ← Fitness replaces ManualLog
│ └─────────────┘ └────────────┘ └─────────────┘          │
│ ┌─ Race Timeline ──────────────  full 1336 ──────────┐ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌──── HYROX 656 ────┐ · · · (reserved 656) · · ·  ← NEW │  half row
│ └───────────────────┘                                   │
│ ┌ BodyCard 525 ┐ ┌──── Body Trend 787 ────┐  2fr 3fr    │
│ └──────────────┘ └────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

### Fitness card — index hero + sparklines (429px)

```
┌─ FITNESS ──────── PEAKING ─┐
│ 72.4  ▲ +3.1    30d        │
│ VO2max 51.1 ▁▂▃▅▆▇  ▲      │
│ VDOT   52.8 ▂▃▄▅▆▇  ▲      │
│ RHR    58   ▇▆▅▄▃▂  ▼ good │
└────────────────────────────┘
```

Composite index as the headline (big, yellow), with three component rows: value +
mini-sparkline + trend arrow. RHR arrow inverts (down = good). Training-status label
top-right. Shows "building…" until ~2–3 weeks of history exist.

### Hyrox card — hero + segment bars + leaks (656px)

```
┌─ HYROX · OPEN SOLO ──────────── 656px ─┐
│ 1:40 proj  1:38–1:43     1:34 stretch   │
│ run███ ski██ push█ pull██▓ bbj████▓     │
│ row██ carry█ lunge██ wb██               │
│ ⚠ leaks: sled-pull setup · BBJ pace     │
└─────────────────────────────────────────┘
```

Big projected finish + range + stretch target. 16-segment bar (width = time per segment;
runs yellow, stations dimmed) wraps to two rows at this width. Leak warnings underneath.

### Mobile

Full-width stack in `MobileOverview`. Both cards 100% width; Hyrox segment bar wraps to
two short rows. ManualLog already absent on mobile.

### Width behavior

Sparklines and segment bars are `flex: 1` → fill whatever column they get (desktop roomy,
mobile narrow). Cards are fixed-height to align their grid row.

---

## Phasing

| Phase | Scope | Ships |
|---|---|---|
| **P1** | `fitness.ts` schema + migration · `fetch.py --metrics` · `lib/fitness/sync.ts` + nightly cron · seed today's row · Fitness card (VO2max + race-pred + RHR) in the 429 slot · hide ManualLog | trend visible |
| **P2** | Uth proxy · composite fitness index (z-scores + 0–100 mapping) · "building…" state | one combined number |
| **P3** | `hyrox_station_benchmark` seeded from sims · `lib/hyrox/predict.ts` · `hyrox_projection` snapshots · Hyrox card (half row) | live race projection |

---

## Decisions (defaults chosen)

| # | Decision | Default |
|---|---|---|
| 1 | maxHR for Uth proxy | **195** (observed sim max) — override if a higher true max is known |
| 2 | Fitness index weights | **equal** (VO2max / VDOT / RHR⁻¹ / load), tune later |
| 3 | Hyrox division | **Open Solo** (152/103 sled); Pro deferred |
| 4 | Index scale | **0–100** mapped (readable headline) vs raw z-sum (abstract) |

---

## Gotchas

- **VO2max latest-only** — cannot backfill history from the API; daily snapshot is the only
  way to build the series. Race predictions are the more responsive trend.
- **Hardware gating is the scope boundary** — lactate threshold, endurance, hill, ACWR, HRV,
  readiness are null on FR245M. A library bump does not change this; only a newer watch would.
- **Python stdout must stay clean JSON** — same rule as `fetch.py` activities and the agent CLI
  shims. All library/login chatter to stderr.
- **Index needs warm-up** — z-scores are meaningless with < ~2–3 weeks of daily rows. Gate the
  card on history length.
- **Indoor Hyrox sims have no GPS** — station segmentation is HR-inferred + manual structure,
  not clean lap data. Don't promise fully-automatic `.fit` parsing for indoor sessions.
- **Defensive `.get()` everywhere** in Python — Garmin's unofficial endpoints return partial /
  null blobs frequently on this device tier.
</content>
</invoke>
