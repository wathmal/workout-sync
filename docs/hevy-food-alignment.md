# Hevy ↔ Food Alignment

## Context

After landing the food/macro logger, the two log workflows had divergent shapes: Hevy was a 3-step transient flow with RSC reads + Hevy as source of truth; food was a single-page persistent flow with a context provider + local Postgres. The dashboard ended up reading two different ways for two domains, and the in-flight `workout-provider` mixed sync state setters with the workflow that no client mirror covered.

This pass aligns the *role* of each layer: domain-scoped providers expose the persistent reads + mutators, page-local state holds in-flight UI, dashboard components read from providers. Inputs UIs stay tuned per domain.

## Decisions

- **Mental model.** Both flows treat input as "log → persistent store". Hevy is SOT for workouts (no local mirror); local Postgres is SOT for food.
- **Provider split.** Keep `workout-provider` for in-flight `/upload→/review` state. Add `hevy-provider` for persistent reads + commit. Symmetric in role with `food-log-provider`.
- **Routes.** Collapse `/sync` into `/review` (inline post-sync hero). `/upload` unchanged. `/food` unchanged.
- **Dashboard.** Drop `app/page.tsx` async/RSC. `MuscleCoverage` reads from `useHevy().coverage`. `ManualLog.WorkoutCard` drops the static "Synced 5m" pill.
- **Refresh.** Top-nav Refresh button calls both providers in parallel. "Last updated" = min of both `lastFetched`.
- **Mutations.** `useHevy().commitWorkout(workout)` wraps `POST /api/hevy-sync` + refresh. `/review` consumes it; raw fetch removed.
- **Dup detection.** `lib/hevy/api.ts:checkForDuplicateWorkout` becomes a pure date-filter against `useHevy().workouts`.
- **Read-only history v1.** No in-app edit/delete on logged workouts; "Open in Hevy" link stays.

## `hevy-provider` shape

```ts
{
  workouts: HevyWorkoutEvent[],         // last 14d
  coverage: { entries, attention },     // computed via lib/dashboard/muscle-coverage on the client
  lastFetched: number | null,
  loading: boolean,
  error: string | null,
  refresh(): Promise<void>,
  commitWorkout(workout: Workout): Promise<SyncSummary>
}
```

`SyncSummary` matches the existing `SyncedWorkoutSummary` shape from `workout-provider.tsx`. Move the type to `lib/hevy/types.ts` (or `lib/types.ts`) so both `/review` and the provider can import it.

## File changes

| File | Action |
|---|---|
| `app/_providers/hevy-provider.tsx` | **NEW** |
| `app/_providers/food-log-provider.tsx` | Expose `lastFetched` |
| `app/_providers/workout-provider.tsx` | Drop `lastSyncedWorkout` slot |
| `app/layout.tsx` | Wrap children in `HevyProvider` |
| `app/page.tsx` | Drop async + RSC fetch; sync shell |
| `app/review/page.tsx` | Use `useHevy().commitWorkout`; absorb sync hero; dup via provider |
| `app/sync/page.tsx` | Delete |
| `components/dashboard/MuscleCoverage.tsx` | Read from `useHevy()` |
| `components/dashboard/ManualLog.tsx` | Drop "Synced 5m" pill |
| `app/_components/top-nav.tsx` | Refresh wires both providers; shared timestamp |
| `lib/hevy/api.ts` | `checkForDuplicateWorkout` becomes pure (date, workouts) filter |
| `app/api/hevy-workouts/route.ts` | Default `since` bump to 14d if not already |

## Gotchas

- **Coverage compute moves client-side.** `lib/dashboard/muscle-coverage.ts` is already pure JS — no change needed; just call it from the provider after `workouts` loads. The previous `app/page.tsx` also passed a `coverageError` prop on Hevy fetch failure; mirror that via the provider's `error`.
- **Hydration.** `app/page.tsx` becomes a sync client/server shell. `MuscleCoverage` is `"use client"` (already is, via recharts). Initial render shows `loading=true` until the provider's first fetch resolves — accept a brief loading shimmer on first paint, same as `CalorieSummary`.
- **Dup detection signature.** Pure version: `findDuplicateOnDate(workoutDate, workouts): DuplicateWorkoutInfo | null`. Keep the existing `DuplicateWorkoutInfo` type for ergonomics.
- **`/sync` route removal.** Search for any internal links pointing to `/sync` and update or delete (`grep -r "/sync" app/ components/`).
- **Workout-provider trim.** Removing `lastSyncedWorkout` is a breaking change for any caller. Confirm only `/sync/page.tsx` consumes it (which we're deleting anyway), then drop.
