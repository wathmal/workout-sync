# Food composite items (FMA multi-meal dishes)

FMA's analyze endpoints now decompose prepared dishes into ingredient **components**. A dish like
"chicken curry" comes back as one `item` with `kind: "composite"`, `matched: null`, and a
`components[]` array (each ingredient matched to a source food with its own grams/ratio/macros); the
item's own `grams`/`macros` are the rollup. Singles are unchanged (`kind` defaults `"single"`).

This integrates that shape into the food log. Status: **design only, not yet built.** Code is canonical
once written.

Composites come **only from the LLM paths** — `/api/food/analyze/text` and `/api/food/analyze/photo`.
Barcode + search stay single-only. The change is additive: existing single responses are byte-identical.

## The new shape

```ts
// lib/food/types.ts — additive
interface FmaComponent {
  input_name: string;
  matched: FmaMatched | null;   // null when an ingredient found no DB match
  grams: number;
  ratio: number;                // mass share of the cooked dish, 0–1
  macros: FmaMacros;
  warnings: string[];
}

interface FmaItem {
  input_name: string;
  kind: "single" | "composite";        // NEW (default "single")
  matched: FmaMatched | null;          // CHANGED: was non-null
  components?: FmaComponent[];          // NEW (composite only)
  amount?: number; unit?: "g" | "mL";  // NEW (ignored — grams suffices)
  grams: number;
  macros: FmaMacros;
  confidence: number;
  warnings: string[];                  // e.g. "decomposed_estimate", "no_match"
  rationale?: string;
}

interface FmaAnalyzeResponse {
  request_id: string;
  meal_name: string | null;
  items: FmaItem[];
  totals: FmaMacros;          // ignored (we sum enabled rows)
  warnings: string[];         // NEW (top-level)
  model_trace?: unknown;      // NEW, optional — ignored
}
```

## Mandatory crash fix

`app/food/page.tsx → fromFmaItem` currently reads `it.matched.source_id/name/serving/food_id/source`
on every line — **it throws the moment `matched` is null** (every composite, and `no_match` singles).
Make it null-safe: `it.matched?.food_id ?? null`, `name = it.matched?.name ?? it.input_name`, etc. This
is required regardless of the rest.

## Decisions

### 1. Logging — one flat row, no migration
A composite is logged as a **single `food_log_entry` row**: `name = input_name`, `grams`, summed
`macros`, fma fields (`fma_food_id`/`fma_source`/`fma_source_id`) null, and the full item (incl.
`components`) persisted in the existing `raw_response` jsonb. Per-gram rates (`kcal_per_g` …) are the
dish total ÷ grams, exactly as today. **No schema migration.**

### 2. Review UI — expandable, read-only breakdown
The composite's review card shows the dish (name + summed macros + a "decomposed" / estimate badge) with
an expand/collapse revealing each component: `input_name → matched.name`, grams, macros, per-component
warnings. This is how the user catches FMA's wrong matches (the live sample mismatched
curry-leaves→Mango, salt→Beans). No per-ingredient editing — accept or drop the whole dish.

### 3. Pre-commit edit — dish grams rescales everything
Editing a composite's grams rescales by `ratio = newGrams / oldGrams`: dish macros via the per-gram
rates, **and** every component's grams + macros × ratio, with `raw_response` rewritten so the stored
breakdown stays consistent with the logged total. No per-ingredient edit, no manual macro override.

### 4. Post-commit — expandable in the day log too
`MealItem` gains `kind` + `components`, read from `raw_response` in `toMealItem` (no new column). Logged
composites drill down in the day log the same way the review card does. Consequence: post-commit
`editGrams` (`lib/food/queries.ts`) must **also** rescale `raw_response.components` by the grams ratio and
write it back — not just the row's macro columns.

### 5. no_match singles — disabled by default
A `kind: "single"` item with `matched: null` (`no_match`, confidence 0, usually 0 macros) is shown but
created `enabled: false` — it won't log unless the user ticks it. Name = `input_name`, fma fields null.
Composites are never treated as no_match (their `matched` is always null by design) and stay enabled.

### 6. Ignored fields
`kind` is read from `raw_response` (no column). `totals`, `model_trace`, item `amount`/`unit` are not
stored or used. Item `name = input_name`; batch `mealName = response.meal_name` (existing
first-write-wins via `appendItems` meta). **No migration anywhere.**

## Touch points

- `lib/food/types.ts` — the type changes above; add `kind?` + `components?` to `MealItem` (+ a
  `MealComponent` display type); make `PendingItem` carry `kind` + `components`.
- `app/food/page.tsx` — `fromFmaItem` null-safe + composite/no_match handling (`enabled = kind === "single"
  && !matched ? false : true`); the composite review card (expandable breakdown); dish-grams rescale-all
  (scale components + rewrite the pending item's `rawResponse`).
- `lib/food/queries.ts` — `toMealItem` reads `raw_response` → `kind` + `components`; `editGrams` rescales
  `raw_response.components` by the grams ratio and writes it back alongside the macro columns.
- the day-log card (where `MealItem`s render — `TodayStrip` / week list) — expandable composite rows.
- **No** schema / drizzle migration.

## Gotchas

- A **component** can be `matched: null` (`ingredient_no_match`) with 0 macros — it still shows in the
  breakdown (read-only), contributing 0 to the dish sum (FMA already rolled it up). Components are never
  individually toggled.
- Use the item's `macros`/`grams` for the logged row (FMA's rollup) — don't re-sum components (rounding).
- `raw_response` is the single source of the breakdown both pre- and post-commit; keep it consistent on
  every grams change (review rescale **and** `editGrams`).
- Distinguish the two `matched: null` cases by `kind`: composite (expected, enabled) vs single
  (`no_match`, disabled-by-default).
