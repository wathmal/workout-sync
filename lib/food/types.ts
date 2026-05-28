/**
 * Domain types for the food/macro logger.
 *
 * FMA response shapes are modeled from bruno/food-macro-api/* fixtures + README.
 * Adjust as FMA evolves.
 */

export type FoodLogSource = "search" | "text" | "photo" | "manual" | "barcode";

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
    fmaFoodId?: number | null;
    fmaSource?: string | null;
    fmaSourceId?: string | null;
    confidence?: number | null;
    warnings?: string[] | null;
    rawResponse?: unknown;
  }>;
}
