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
  FoodLogSource,
  MealComponent,
  PendingItem,
} from "./types";

export function fmaComponentToMeal(c: FmaComponent): MealComponent {
  return {
    inputName: c.input_name,
    name: c.matched?.name ?? c.input_name,
    grams: c.grams,
    kcal: c.macros.kcal,
    proteinG: c.macros.protein_g,
    carbsG: c.macros.carbs_g,
    fatG: c.macros.fat_g,
    warnings: c.warnings ?? [],
    matched: c.matched ? { source: c.matched.source, name: c.matched.name } : null,
  };
}

/** FmaItem → PendingItem. Null-safe; composites + `no_match` singles supported. */
export function fromFmaItem(it: FmaItem, idx: number, source: FoodLogSource): PendingItem {
  const g = it.grams;
  const basePerG =
    g > 0
      ? {
          kcal: it.macros.kcal / g,
          proteinG: it.macros.protein_g / g,
          carbsG: it.macros.carbs_g / g,
          fatG: it.macros.fat_g / g,
        }
      : null;

  const isComposite = it.kind === "composite";
  // A single FMA couldn't match (no_match) → start unticked so it won't log.
  const noMatchSingle = !isComposite && !it.matched;

  return {
    key: `fma-${idx}-${it.matched?.source_id ?? `x-${idx}`}`,
    source,
    name: it.matched?.name ?? it.input_name ?? "Unknown",
    grams: it.grams,
    kcal: it.macros.kcal,
    proteinG: it.macros.protein_g,
    carbsG: it.macros.carbs_g,
    fatG: it.macros.fat_g,
    basePerG,
    serving: it.matched?.serving ?? null,
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
    baseGrams: it.grams,
  };
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

/** Scale a raw FMA item (snake) by `factor` — grams, macros, and each component. */
export function scaleFmaItem(it: FmaItem, factor: number): FmaItem {
  return {
    ...it,
    grams: it.grams * factor,
    macros: scaleMacros(it.macros, factor),
    components: it.components?.map((c) => ({
      ...c,
      grams: c.grams * factor,
      macros: scaleMacros(c.macros, factor),
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
  const base = item.baseGrams && item.baseGrams > 0 ? item.baseGrams : it.grams || 1;
  const factor = (item.grams || 0) / base;
  return factor === 1 ? it : scaleFmaItem(it, factor);
}
