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
  | "off";

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
  serving?: FmaServing | null;
}

export interface FmaMacros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FmaItem {
  input_name?: string;
  matched: FmaMatched;
  grams: number;
  macros: FmaMacros;
  confidence: number;
  warnings: string[];
  rationale?: string;
}

export interface FmaAnalyzeResponse {
  request_id: string;
  meal_name?: string;
  items: FmaItem[];
  totals: FmaMacros;
}

export interface FmaSearchHit {
  food_id: number;
  source: string;
  source_id: string;
  name: string;
  locale?: string;
  license?: string;
  kcal_per_100g?: number;
  protein_g_per_100g?: number;
  carbs_g_per_100g?: number;
  fat_g_per_100g?: number;
  density_g_per_ml?: number | null;
  serving?: FmaServing | null;
  score?: number;
}

export interface FmaSearchResponse {
  request_id?: string;
  query?: string;
  total?: number;
  limit?: number;
  offset?: number;
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
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  license: string;
  score: number;
}

export interface FmaOffSearchResponse {
  request_id?: string;
  query?: string;
  total?: number;
  page?: number;
  limit?: number;
  items: FmaOffSearchHit[];
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

export interface QuickAddSuggestion {
  name: string;
  /** grams of the most recent log for this name. */
  grams: number;
  /** macros of the most recent log for this name (absolute, not per-g). */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
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
  }>;
}
