import "server-only";
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { favoriteMeal, foodLogEntry } from "./schema";
import type {
  DayAggregate,
  FavoriteMeal,
  FavoriteMealItem,
  FmaItem,
  MealBatchInput,
  MealItem,
} from "./types";
import { fmaComponentToMeal, scaleFmaItem } from "./convert";
import { favoriteSignature } from "./favorite-signature";
import { todayInUserTz } from "./targets";

function userTz(): string {
  return process.env.USER_TZ ?? "UTC";
}

/**
 * A raw FMA item is the post-migration shape iff it carries a `nutrients` block.
 * Rows logged before migration 0001 hold the old flat shape (`grams`/`macros` at
 * top level) and can't be reparsed — callers must treat them as legacy.
 */
function isUnifiedFmaItem(raw: unknown): raw is FmaItem {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as { nutrients?: unknown }).nutrients === "object" &&
    (raw as { nutrients?: unknown }).nutrients !== null
  );
}

/**
 * Pull kind + ingredient breakdown out of the stored FMA item (composites only).
 * Legacy (pre-migration) composites keep `kind` but get `components: null` — the
 * old flat breakdown can't be reparsed — which the UI renders as a locked row.
 */
function compositeFromRaw(raw: unknown): Pick<MealItem, "kind" | "components"> {
  const it = raw as FmaItem | null;
  if (it && it.kind === "composite") {
    if (isUnifiedFmaItem(it) && Array.isArray(it.components)) {
      return { kind: "composite", components: it.components.map(fmaComponentToMeal) };
    }
    return { kind: "composite", components: null };
  }
  return {};
}

function toMealItem(r: typeof foodLogEntry.$inferSelect): MealItem {
  return {
    id: r.id,
    batchId: r.batchId,
    loggedAt: r.loggedAt.toISOString(),
    source: r.source,
    mealName: r.mealName,
    name: r.name,
    // grams + per-g rates are null for unit='serving' (label) items → 0 (hidden).
    grams: r.grams != null ? Number(r.grams) : 0,
    kcal: Number(r.kcal),
    proteinG: Number(r.proteinG),
    carbsG: Number(r.carbsG),
    fatG: Number(r.fatG),
    kcalPerG: r.kcalPerG != null ? Number(r.kcalPerG) : 0,
    proteinPerG: r.proteinPerG != null ? Number(r.proteinPerG) : 0,
    carbsPerG: r.carbsPerG != null ? Number(r.carbsPerG) : 0,
    fatPerG: r.fatPerG != null ? Number(r.fatPerG) : 0,
    unit: (r.unit as "g" | "serving") ?? "g",
    servings: r.servings != null ? Number(r.servings) : null,
    servingLabel: r.servingLabel ?? null,
    fmaFoodId: r.fmaFoodId,
    fmaSource: r.fmaSource,
    fmaSourceId: r.fmaSourceId,
    confidence: r.confidence !== null ? Number(r.confidence) : null,
    warnings: (r.warnings as string[] | null) ?? null,
    note: r.note,
    ...compositeFromRaw(r.rawResponse),
  };
}

function safeDiv(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

export async function getDay(dateStr: string = todayInUserTz()): Promise<MealItem[]> {
  const tz = userTz();
  const startStr = `${dateStr} 00:00:00`;
  const endStr = `${dateStr} 00:00:00`;
  const rows = await db
    .select()
    .from(foodLogEntry)
    .where(sql`
      ${foodLogEntry.loggedAt} >= (${startStr}::timestamp AT TIME ZONE ${tz})
      AND ${foodLogEntry.loggedAt} < ((${endStr}::timestamp + INTERVAL '1 day') AT TIME ZONE ${tz})
    `)
    .orderBy(desc(foodLogEntry.loggedAt));
  return rows.map(toMealItem);
}

/**
 * Mon..Sun aggregates covering the week that contains `anchorStr` in USER_TZ
 * (defaults to today — the dashboard week slider passes a past anchor date).
 * `isToday`/`isPlanned` are always relative to the real current day, so a past
 * week has no day flagged today/planned. Future days render zero but planned.
 */
export async function getWeek(
  anchorStr: string = todayInUserTz(),
): Promise<DayAggregate[]> {
  const today = todayInUserTz(); // YYYY-MM-DD — real current day, for flags
  const anchorDate = new Date(`${anchorStr}T00:00:00Z`); // civil date in the target week
  // Mon = 1 in ISO; getUTCDay: Sun=0, Mon=1, ... Sat=6
  const dow = anchorDate.getUTCDay(); // 0..6
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(anchorDate);
  monday.setUTCDate(anchorDate.getUTCDate() - daysSinceMonday);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }

  const tz = userTz();
  const { rows } = await db.execute<{
    day: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
    kcal: string;
  }>(sql`
    SELECT
      to_char(date_trunc('day', logged_at AT TIME ZONE ${tz}), 'YYYY-MM-DD') AS day,
      SUM(protein_g)::text AS protein_g,
      SUM(carbs_g)::text   AS carbs_g,
      SUM(fat_g)::text     AS fat_g,
      SUM(kcal)::text      AS kcal
    FROM ${foodLogEntry}
    WHERE logged_at >= (${`${days[0]} 00:00:00`}::timestamp AT TIME ZONE ${tz})
      AND logged_at <  ((${`${days[6]} 00:00:00`}::timestamp + INTERVAL '1 day') AT TIME ZONE ${tz})
    GROUP BY 1
  `);

  const byDay = new Map(rows.map((r) => [r.day, r]));
  return days.map((date, i) => {
    const r = byDay.get(date);
    const proteinG = r ? Number(r.protein_g) : 0;
    const carbsG = r ? Number(r.carbs_g) : 0;
    const fatG = r ? Number(r.fat_g) : 0;
    const totalKcal = r ? Number(r.kcal) : 0;
    return {
      date,
      dow: i, // 0 = Mon
      proteinKcal: proteinG * 4,
      carbsKcal: carbsG * 4,
      fatKcal: fatG * 9,
      totalKcal,
      proteinG,
      carbsG,
      fatG,
      isToday: date === today,
      isPlanned: date > today,
    };
  });
}

export async function insertBatch(input: MealBatchInput): Promise<MealItem[]> {
  const batchId = randomUUID();
  const loggedAt = new Date(input.loggedAt);
  const rows = await db
    .insert(foodLogEntry)
    .values(
      input.items.map((it) => {
        // unit='serving' (label) items are grams-free: scaled by `servings`,
        // not grams, so grams + per-g rates are stored null.
        const isServing = it.unit === "serving";
        return {
        batchId,
        loggedAt,
        source: it.source ?? input.source,
        name: it.name,
        unit: it.unit ?? "g",
        servings: isServing ? (it.servings ?? 1).toString() : null,
        servingLabel: it.servingLabel ?? null,
        grams: isServing ? null : it.grams.toString(),
        kcal: it.kcal.toString(),
        proteinG: it.proteinG.toString(),
        carbsG: it.carbsG.toString(),
        fatG: it.fatG.toString(),
        kcalPerG: isServing ? null : safeDiv(it.kcal, it.grams).toString(),
        proteinPerG: isServing ? null : safeDiv(it.proteinG, it.grams).toString(),
        carbsPerG: isServing ? null : safeDiv(it.carbsG, it.grams).toString(),
        fatPerG: isServing ? null : safeDiv(it.fatG, it.grams).toString(),
        fmaFoodId: it.fmaFoodId ?? null,
        fmaSource: it.fmaSource ?? null,
        fmaSourceId: it.fmaSourceId ?? null,
        confidence: it.confidence !== undefined && it.confidence !== null ? it.confidence.toString() : null,
        warnings: it.warnings ?? null,
        rawResponse: (it.rawResponse as object | undefined) ?? null,
        mealName: input.mealName ?? null,
        note: input.note ?? null,
        };
      }),
    )
    .returning();
  return rows.map(toMealItem);
}

export async function deleteBatch(batchId: string): Promise<number> {
  const rows = await db
    .delete(foodLogEntry)
    .where(eq(foodLogEntry.batchId, batchId))
    .returning({ id: foodLogEntry.id });
  return rows.length;
}

export async function editGrams(itemId: string, newGrams: number): Promise<MealItem | null> {
  const [existing] = await db
    .select()
    .from(foodLogEntry)
    .where(eq(foodLogEntry.id, itemId))
    .limit(1);
  if (!existing) return null;

  const kcalPerG = Number(existing.kcalPerG);
  const proteinPerG = Number(existing.proteinPerG);
  const carbsPerG = Number(existing.carbsPerG);
  const fatPerG = Number(existing.fatPerG);

  // Keep a composite's stored ingredient breakdown consistent with the new grams.
  // Legacy (pre-migration) composites have no `nutrients` block to rescale — the
  // UI locks their grams, so we never reach here for one; skip defensively.
  const oldGrams = Number(existing.grams);
  const rawItem = existing.rawResponse;
  const rescaledRaw =
    isUnifiedFmaItem(rawItem) && rawItem.kind === "composite" && oldGrams > 0
      ? scaleFmaItem(rawItem, newGrams / oldGrams)
      : undefined;

  const [updated] = await db
    .update(foodLogEntry)
    .set({
      grams: newGrams.toString(),
      kcal: (kcalPerG * newGrams).toString(),
      proteinG: (proteinPerG * newGrams).toString(),
      carbsG: (carbsPerG * newGrams).toString(),
      fatG: (fatPerG * newGrams).toString(),
      ...(rescaledRaw ? { rawResponse: rescaledRaw } : {}),
    })
    .where(eq(foodLogEntry.id, itemId))
    .returning();

  return updated ? toMealItem(updated) : null;
}

/**
 * Rescale a unit='serving' (label) item to `newServings`. Totals scale by the
 * servings ratio (per-serving rate is implicit = total/servings); grams stay
 * null. No-op (returns null) for gram items or zero-baseline rows.
 */
export async function editServings(itemId: string, newServings: number): Promise<MealItem | null> {
  const [existing] = await db
    .select()
    .from(foodLogEntry)
    .where(eq(foodLogEntry.id, itemId))
    .limit(1);
  if (!existing) return null;

  const oldServings = Number(existing.servings);
  if (existing.unit !== "serving" || !(oldServings > 0)) return null;

  const f = newServings / oldServings;
  const [updated] = await db
    .update(foodLogEntry)
    .set({
      servings: newServings.toString(),
      kcal: (Number(existing.kcal) * f).toString(),
      proteinG: (Number(existing.proteinG) * f).toString(),
      carbsG: (Number(existing.carbsG) * f).toString(),
      fatG: (Number(existing.fatG) * f).toString(),
    })
    .where(eq(foodLogEntry.id, itemId))
    .returning();

  return updated ? toMealItem(updated) : null;
}

function toFavoriteMeal(r: typeof favoriteMeal.$inferSelect): FavoriteMeal {
  return {
    id: r.id,
    signature: r.signature,
    mealName: r.mealName,
    items: (r.items as FavoriteMealItem[]) ?? [],
    createdAt: r.createdAt.toISOString(),
  };
}

/** All favorites, most-recently-favorited first (drives dashboard chips + tab). */
export async function getFavorites(): Promise<FavoriteMeal[]> {
  const rows = await db
    .select()
    .from(favoriteMeal)
    .orderBy(desc(favoriteMeal.createdAt));
  return rows.map(toFavoriteMeal);
}

/**
 * Favorite a logged batch: freeze its current items (incl. per-gram rates + FMA
 * ids) into a durable snapshot keyed by content signature. Idempotent — a batch
 * whose signature already exists returns the existing favorite untouched.
 */
export async function addFavorite(batchId: string): Promise<FavoriteMeal> {
  const rows = await db
    .select()
    .from(foodLogEntry)
    .where(eq(foodLogEntry.batchId, batchId));
  if (rows.length === 0) {
    throw new Error("No logged batch found for that id.");
  }

  const mealName = rows[0].mealName;
  const items: FavoriteMealItem[] = rows.map((r) => ({
    name: r.name,
    grams: r.grams != null ? Number(r.grams) : 0,
    kcal: Number(r.kcal),
    proteinG: Number(r.proteinG),
    carbsG: Number(r.carbsG),
    fatG: Number(r.fatG),
    kcalPerG: r.kcalPerG != null ? Number(r.kcalPerG) : 0,
    proteinPerG: r.proteinPerG != null ? Number(r.proteinPerG) : 0,
    carbsPerG: r.carbsPerG != null ? Number(r.carbsPerG) : 0,
    fatPerG: r.fatPerG != null ? Number(r.fatPerG) : 0,
    fmaFoodId: r.fmaFoodId,
    fmaSource: r.fmaSource,
    fmaSourceId: r.fmaSourceId,
    unit: (r.unit as "g" | "serving") ?? "g",
    servings: r.servings != null ? Number(r.servings) : null,
    servingLabel: r.servingLabel ?? null,
  }));
  const signature = favoriteSignature(
    mealName,
    items.map((i) => i.name),
  );

  const [inserted] = await db
    .insert(favoriteMeal)
    .values({ signature, mealName, items })
    .onConflictDoNothing({ target: favoriteMeal.signature })
    .returning();
  if (inserted) return toFavoriteMeal(inserted);

  // Conflict: the meal is already a favorite — return the existing row.
  const [existing] = await db
    .select()
    .from(favoriteMeal)
    .where(eq(favoriteMeal.signature, signature))
    .limit(1);
  return toFavoriteMeal(existing);
}

export async function removeFavorite(id: string): Promise<number> {
  const rows = await db
    .delete(favoriteMeal)
    .where(eq(favoriteMeal.id, id))
    .returning({ id: favoriteMeal.id });
  return rows.length;
}
