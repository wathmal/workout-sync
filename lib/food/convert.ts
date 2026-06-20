/**
 * Pure FMA → app conversions for the food review flow. Kept out of the client
 * page so it's unit-testable. Handles the composite-dish shape: `matched` may be
 * null (every composite, and `no_match` singles), and composites carry a
 * `components[]` ingredient breakdown.
 *
 * See docs/food-composite-items.md.
 */
import type {
  FmaItem,
  FmaComponent,
  FmaMacros,
  FmaNutrients,
  FmaServing,
  FoodLogSource,
  MealComponent,
  PendingItem,
} from "./types";

/**
 * Default grams for a search hit: the serving amount when present (g or mL —
 * density~1 assumed for mL), else 100. Guards against null/zero/negative.
 */
export function defaultGramsForHit(serving: FmaServing | null | undefined): number {
  const a = serving?.amount;
  return a != null && a > 0 ? a : 100;
}

export function fmaComponentToMeal(c: FmaComponent): MealComponent {
  const m = c.nutrients.macros;
  return {
    inputName: c.input_name,
    name: c.matched?.name ?? c.input_name,
    grams: c.nutrients.grams,
    kcal: m.kcal,
    proteinG: m.protein_g,
    carbsG: m.carbs_g,
    fatG: m.fat_g,
    warnings: c.warnings ?? [],
    matched: c.matched ? { source: c.matched.source, name: c.matched.name } : null,
  };
}

/** FmaItem → PendingItem. Null-safe; composites + `no_match` singles supported. */
export function fromFmaItem(it: FmaItem, idx: number, source: FoodLogSource): PendingItem {
  const m = it.nutrients.macros;
  const g = it.nutrients.grams;
  const basePerG =
    g > 0
      ? {
          kcal: m.kcal / g,
          proteinG: m.protein_g / g,
          carbsG: m.carbs_g / g,
          fatG: m.fat_g / g,
        }
      : null;

  const isComposite = it.kind === "composite";
  // A single FMA couldn't match (no_match) → start unticked so it won't log.
  const noMatchSingle = !isComposite && !it.matched;

  return {
    key: `fma-${idx}-${it.matched?.source_id ?? `x-${idx}`}`,
    source,
    name: it.matched?.name ?? it.input_name ?? "Unknown",
    grams: g,
    kcal: m.kcal,
    proteinG: m.protein_g,
    carbsG: m.carbs_g,
    fatG: m.fat_g,
    basePerG,
    serving: it.nutrients.serving ?? null,
    fmaFoodId: it.matched?.food_id ?? null,
    fmaSource: it.matched?.source ?? null,
    fmaSourceId: it.matched?.source_id ?? null,
    confidence: it.confidence,
    warnings: it.warnings,
    rationale: it.rationale,
    rawResponse: it,
    enabled: !noMatchSingle,
    kind: isComposite ? "composite" : "single",
    components: isComposite ? (it.components ?? []).map(fmaComponentToMeal) : undefined,
    baseGrams: g,
  };
}

/**
 * FmaItem (`basis: per_serving`, label passthrough) → PendingItem on the
 * SERVINGS axis. The serving IS the unit: macros are per-1-serving, scaled by a
 * `servings` count — no grams, no per_100g derivation. Brand (when present) is
 * prefixed into the name.
 */
export function fromFmaLabelItem(it: FmaItem, idx: number): PendingItem {
  const m = it.nutrients.macros;
  const base = it.input_name ?? it.matched?.name ?? "Unknown";
  const brand = it.source_ref?.brand;
  const name = brand ? `${brand} ${base}` : base;

  return {
    key: `label-${idx}-${it.source_ref?.brand ?? base}`,
    source: "label",
    name,
    grams: 0, // grams-free; hidden in the UI for serving items
    kcal: m.kcal,
    proteinG: m.protein_g,
    carbsG: m.carbs_g,
    fatG: m.fat_g,
    basePerG: null,
    serving: it.nutrients.serving ?? null,
    fmaFoodId: null,
    fmaSource: null,
    fmaSourceId: null,
    confidence: it.confidence,
    warnings: it.warnings,
    rationale: it.rationale,
    rawResponse: it,
    enabled: true,
    kind: "single",
    unit: "serving",
    servings: 1,
    servingLabel: it.nutrients.serving?.label ?? "1 serving",
  };
}

/**
 * Dispatch an analyze item to the right mapper by `nutrients.basis`:
 * `per_serving` → servings axis ({@link fromFmaLabelItem}); everything else
 * (`per_portion`, `per_100g`, or an unknown future basis) → grams axis
 * ({@link fromFmaItem}). Future-proof: routes by shape, not by endpoint.
 */
export function fromFmaAnalyzeItem(it: FmaItem, idx: number, source: FoodLogSource): PendingItem {
  return it.nutrients.basis === "per_serving"
    ? fromFmaLabelItem(it, idx)
    : fromFmaItem(it, idx, source);
}

/** Scale a camelCase component breakdown by `factor` (for display/storage). */
export function scaleMealComponents(components: MealComponent[], factor: number): MealComponent[] {
  return components.map((c) => ({
    ...c,
    grams: c.grams * factor,
    kcal: c.kcal * factor,
    proteinG: c.proteinG * factor,
    carbsG: c.carbsG * factor,
    fatG: c.fatG * factor,
  }));
}

/**
 * The composite's components scaled to the pending item's CURRENT grams, from the
 * immutable base at `baseGrams`. Recomputing from base (not multiplying current)
 * means editing grams to 0 and back recovers — same property as `basePerG`.
 */
export function displayComponents(item: PendingItem): MealComponent[] {
  if (!item.components?.length) return [];
  const base = item.baseGrams && item.baseGrams > 0 ? item.baseGrams : item.grams || 1;
  return scaleMealComponents(item.components, (item.grams || 0) / base);
}

function scaleMacros(m: FmaMacros, factor: number): FmaMacros {
  return {
    kcal: m.kcal * factor,
    protein_g: m.protein_g * factor,
    carbs_g: m.carbs_g * factor,
    fat_g: m.fat_g * factor,
  };
}

/**
 * Scale the portion-dependent fields of a nutrients block. `basis`, `serving`,
 * `extra`, and the `per_100g` sidecar are portion-independent — left untouched.
 */
function scaleNutrients(n: FmaNutrients, factor: number): FmaNutrients {
  return { ...n, grams: n.grams * factor, macros: scaleMacros(n.macros, factor) };
}

/** Scale a raw FMA item by `factor` — its nutrients and each component's. */
export function scaleFmaItem(it: FmaItem, factor: number): FmaItem {
  return {
    ...it,
    nutrients: scaleNutrients(it.nutrients, factor),
    components: it.components?.map((c) => ({
      ...c,
      nutrients: scaleNutrients(c.nutrients, factor),
    })),
  };
}

/**
 * raw_response payload to persist for a pending item: for a composite whose grams
 * were edited, rescale the original FMA item from base so the stored breakdown
 * matches the logged total. Singles (and unchanged composites) pass through.
 */
export function pendingRawResponse(item: PendingItem): unknown {
  const it = item.rawResponse as FmaItem | undefined;
  if (!it || item.kind !== "composite") return item.rawResponse;
  const base = item.baseGrams && item.baseGrams > 0 ? item.baseGrams : it.nutrients.grams || 1;
  const factor = (item.grams || 0) / base;
  return factor === 1 ? it : scaleFmaItem(it, factor);
}
