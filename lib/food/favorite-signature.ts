import type { MealItem } from "./types";

/**
 * Pure, shared (client + server) helper that derives a favorite meal's content
 * signature. Two logs of the same foods produce the same signature regardless of
 * portion or item order, so favoriting is idempotent and the MealRow star can
 * reflect "this meal is favorited" for any matching batch.
 *
 * Deliberately PORTION-AGNOSTIC: grams are excluded. Same foods at different
 * grams collapse to one favorite (chip re-logs the snapshot's stored grams).
 */

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

const FIELD_SEP = ""; // unlikely to appear in food names
const ITEM_SEP = "";

export function favoriteSignature(
  mealName: string | null,
  itemNames: string[],
): string {
  const name = normalize(mealName ?? "");
  const items = itemNames
    .map(normalize)
    .filter((n) => n.length > 0)
    .sort();
  return `${name}${FIELD_SEP}${items.join(ITEM_SEP)}`;
}

/** Convenience: signature for a batch of logged items (all share mealName). */
export function signatureFromMealItems(items: MealItem[]): string {
  return favoriteSignature(
    items[0]?.mealName ?? null,
    items.map((i) => i.name),
  );
}
