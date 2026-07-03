/**
 * Domain types for the food/macro logger.
 *
 * FMA response shapes are modeled from bruno/food-macro-api/* fixtures + README.
 * Adjust as FMA evolves.
 */

export type FoodLogSource =
  | "search"
  | "text"
  | "photo"
  | "manual"
  | "barcode"
  | "off"
  | "label";

/**
 * Portion axis for a logged/pending item.
 * - `"g"`: gram-based (grams + per-gram rates drive scaling) — the default.
 * - `"serving"`: label item with `basis: per_serving` — scaled by a servings
 *   count; grams-free (per-serving rate = kcal / servings).
 */
export type PortionUnit = "g" | "serving";

/** Serving descriptor from FMA (e.g. `{ label: "1 slice", amount: 30, unit: "g" }`). */
export interface FmaServing {
  label: string | null;
  amount: number | null;
  unit: "g" | "mL" | null;
}

export interface FmaMatched {
  food_id: number;
  source: string;
  source_id: string;
  name: string;
  locale: string;
  license: string;
}

export interface FmaMacros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Which portion the `macros` describe. */
export type FmaBasis = "per_portion" | "per_100g" | "per_serving";

/**
 * Unified nutrient block (FMA migration 0001). Carries the basis, the grams the
 * `macros` apply to, the serving descriptor, a `per_100g` comparability sidecar
 * (null when upstream had none), and an open `extra` map of panel nutrients.
 */
export interface FmaNutrients {
  basis: FmaBasis;
  grams: number;
  serving: FmaServing | null;
  macros: FmaMacros;
  per_100g: FmaMacros | null;
  extra: Record<string, number> | null;
}

/** One ingredient inside a composite dish. `matched` is null when no DB match. */
export interface FmaComponent {
  input_name: string;
  matched: FmaMatched | null;
  ratio: number;
  nutrients: FmaNutrients;
  warnings: string[];
}

export interface FmaItem {
  input_name?: string;
  /** "single" = one matched food; "composite" = decomposed dish (matched null, components set). */
  kind?: "single" | "composite";
  matched: FmaMatched | null;
  /** Passthrough provenance for label items (`basis: per_serving`); brand nullable. */
  source_ref?: { kind: string; brand: string | null };
  components?: FmaComponent[];
  amount?: number;
  unit?: "g" | "mL";
  nutrients: FmaNutrients;
  confidence: number;
  warnings: string[];
  rationale?: string;
}

export interface FmaAnalyzeResponse {
  request_id: string;
  meal_name?: string;
  items: FmaItem[];
  /** Unified totals block. The app computes its own totals client-side; unused. */
  totals: FmaNutrients;
  /** Top-level warnings (additive). */
  warnings?: string[];
  /** Pipeline timing/cost when include: ["trace"]. Ignored by the app. */
  model_trace?: unknown;
}

export interface FmaSearchHit {
  food_id: number;
  source: string;
  source_id: string;
  name: string;
  locale?: string;
  license?: string;
  /** per_100g basis: `nutrients.macros` == `nutrients.per_100g`. */
  nutrients: FmaNutrients;
  density_g_per_ml?: number | null;
  score?: number;
}

export interface FmaSearchResponse {
  request_id?: string;
  query?: string;
  total?: number;
  limit?: number;
  page?: number;
  items: FmaSearchHit[];
}

/**
 * Live Open Food Facts search hit (`GET /v1/off/search`). Identity + per-100g
 * macros only — no serving size, no local `food_id`/`source_id`. Resolve the
 * `barcode` via `POST /v1/analyze/barcode` to get a loggable item with serving.
 */
export interface FmaOffSearchHit {
  source: "off";
  barcode: string;
  name: string | null;
  brands: string[];
  /**
   * per_100g basis. Macros are 0-filled when upstream lacked a value — use
   * `nutrients.per_100g === null` or `warnings` to detect missing data.
   */
  nutrients: FmaNutrients;
  license: string;
  score: number;
  warnings?: string[];
}

export interface FmaOffSearchResponse {
  request_id?: string;
  query?: string;
  total?: number;
  page?: number;
  limit?: number;
  items: FmaOffSearchHit[];
}

/** One ingredient of a logged/pending composite dish (camelCase, for display). */
export interface MealComponent {
  inputName: string;
  /** matched food name, or the input name when unmatched. */
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  warnings: string[];
  matched: { source: string; name: string } | null;
}

/** Application-side representation of a logged item. */
export interface MealItem {
  id: string;
  batchId: string;
  loggedAt: string;
  source: FoodLogSource;
  mealName: string | null;
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalPerG: number;
  proteinPerG: number;
  carbsPerG: number;
  fatPerG: number;
  fmaFoodId: number | null;
  fmaSource: string | null;
  fmaSourceId: string | null;
  confidence: number | null;
  warnings: string[] | null;
  note: string | null;
  /** Set for composite dishes (read from raw_response). */
  kind?: "single" | "composite";
  /** Ingredient breakdown for composites; null/undefined for singles. */
  components?: MealComponent[] | null;
  /** Portion axis. `"serving"` items scale by `servings` and hide grams. */
  unit: PortionUnit;
  /** Servings count for `unit:"serving"` items; null for gram items. */
  servings: number | null;
  /** Serving descriptor for label items (e.g. "1 burger"); null otherwise. */
  servingLabel: string | null;
}

/**
 * In-flight review item (pre-commit). Lives here (not in the page) so the pure
 * converter in lib/food/convert.ts can build + test it without the client page.
 */
export interface PendingItem {
  /** stable local key */
  key: string;
  /** origin tab this item came from */
  source: FoodLogSource;
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /**
   * Per-gram macro basis captured at creation. Lets grams edits rescale from a
   * fixed rate instead of multiplying current values — which breaks once grams
   * hits 0 (clear the field) and can never recover. null when the source had no
   * positive grams to derive a rate from.
   */
  basePerG?: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null;
  /** FMA serving descriptor, for display in review (not persisted). */
  serving?: FmaServing | null;
  fmaFoodId?: number | null;
  fmaSource?: string | null;
  fmaSourceId?: string | null;
  confidence?: number | null;
  warnings?: string[];
  rationale?: string;
  rawResponse?: unknown;
  enabled: boolean;
  /** "composite" dishes carry a component breakdown. */
  kind?: "single" | "composite";
  /** Original (base) component breakdown at `baseGrams`; rescaled for display/commit. */
  components?: MealComponent[];
  /** Dish grams the base components were computed at — the rescale denominator. */
  baseGrams?: number;
  /**
   * Portion axis. `"serving"` (label / `basis: per_serving`) items scale by
   * `servings` and have no grams; `"g"` (default) items use the grams field.
   */
  unit?: PortionUnit;
  /** Servings count for `unit:"serving"` items (default 1). */
  servings?: number;
  /** Serving descriptor for label items (e.g. "1 burger"). */
  servingLabel?: string | null;
}

/** Per-day aggregate for the dashboard week stack. */
export interface DayAggregate {
  /** YYYY-MM-DD in USER_TZ. */
  date: string;
  /** Mon..Sun. */
  dow: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
  totalKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isToday: boolean;
  isPlanned: boolean;
}

export interface MacroTarget {
  id: string;
  startDate: string;
  endDate: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note: string | null;
}

/** One frozen item inside a favorited meal snapshot. */
export interface FavoriteMealItem {
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalPerG: number;
  proteinPerG: number;
  carbsPerG: number;
  fatPerG: number;
  fmaFoodId: number | null;
  fmaSource: string | null;
  fmaSourceId: string | null;
  /** Portion axis (frozen so a re-log rebuilds the same kind of item). */
  unit?: PortionUnit;
  servings?: number | null;
  servingLabel?: string | null;
}

/** A user-favorited meal: a durable snapshot of a logged batch. */
export interface FavoriteMeal {
  id: string;
  /** Content signature (normalized meal name + sorted item names, portion-agnostic). */
  signature: string;
  mealName: string | null;
  items: FavoriteMealItem[];
  createdAt: string;
}

export interface MealBatchInput {
  loggedAt: string;
  source: FoodLogSource;
  mealName?: string | null;
  note?: string;
  items: Array<{
    name: string;
    grams: number;
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    /** Per-item origin. Falls back to the batch-level `source` when omitted. */
    source?: FoodLogSource;
    fmaFoodId?: number | null;
    fmaSource?: string | null;
    fmaSourceId?: string | null;
    confidence?: number | null;
    warnings?: string[] | null;
    rawResponse?: unknown;
    /** Portion axis. `"serving"` → grams ignored, scaled by `servings`. */
    unit?: PortionUnit;
    servings?: number;
    servingLabel?: string | null;
  }>;
}
