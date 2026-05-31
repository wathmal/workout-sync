import "server-only";
import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { foodLogEntry } from "./schema";
import type {
  DayAggregate,
  MealBatchInput,
  MealItem,
  QuickAddSuggestion,
} from "./types";
import { todayInUserTz } from "./targets";

function userTz(): string {
  return process.env.USER_TZ ?? "UTC";
}

function toMealItem(r: typeof foodLogEntry.$inferSelect): MealItem {
  return {
    id: r.id,
    batchId: r.batchId,
    loggedAt: r.loggedAt.toISOString(),
    source: r.source,
    mealName: r.mealName,
    name: r.name,
    grams: Number(r.grams),
    kcal: Number(r.kcal),
    proteinG: Number(r.proteinG),
    carbsG: Number(r.carbsG),
    fatG: Number(r.fatG),
    kcalPerG: Number(r.kcalPerG),
    proteinPerG: Number(r.proteinPerG),
    carbsPerG: Number(r.carbsPerG),
    fatPerG: Number(r.fatPerG),
    fmaFoodId: r.fmaFoodId,
    fmaSource: r.fmaSource,
    fmaSourceId: r.fmaSourceId,
    confidence: r.confidence !== null ? Number(r.confidence) : null,
    warnings: (r.warnings as string[] | null) ?? null,
    note: r.note,
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
 * Mon..Sun aggregates covering the week that contains `today` in USER_TZ.
 * Future days render with zero macros but `isPlanned: true`.
 */
export async function getCurrentWeek(): Promise<DayAggregate[]> {
  const today = todayInUserTz(); // YYYY-MM-DD
  const todayDate = new Date(`${today}T00:00:00Z`); // treated as a civil date
  // Mon = 1 in ISO; getUTCDay: Sun=0, Mon=1, ... Sat=6
  const dow = todayDate.getUTCDay(); // 0..6
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(todayDate);
  monday.setUTCDate(todayDate.getUTCDate() - daysSinceMonday);

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
      input.items.map((it) => ({
        batchId,
        loggedAt,
        source: it.source ?? input.source,
        name: it.name,
        grams: it.grams.toString(),
        kcal: it.kcal.toString(),
        proteinG: it.proteinG.toString(),
        carbsG: it.carbsG.toString(),
        fatG: it.fatG.toString(),
        kcalPerG: safeDiv(it.kcal, it.grams).toString(),
        proteinPerG: safeDiv(it.proteinG, it.grams).toString(),
        carbsPerG: safeDiv(it.carbsG, it.grams).toString(),
        fatPerG: safeDiv(it.fatG, it.grams).toString(),
        fmaFoodId: it.fmaFoodId ?? null,
        fmaSource: it.fmaSource ?? null,
        fmaSourceId: it.fmaSourceId ?? null,
        confidence: it.confidence !== undefined && it.confidence !== null ? it.confidence.toString() : null,
        warnings: it.warnings ?? null,
        rawResponse: (it.rawResponse as object | undefined) ?? null,
        mealName: input.mealName ?? null,
        note: input.note ?? null,
      })),
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

  const [updated] = await db
    .update(foodLogEntry)
    .set({
      grams: newGrams.toString(),
      kcal: (kcalPerG * newGrams).toString(),
      proteinG: (proteinPerG * newGrams).toString(),
      carbsG: (carbsPerG * newGrams).toString(),
      fatG: (fatPerG * newGrams).toString(),
    })
    .where(eq(foodLogEntry.id, itemId))
    .returning();

  return updated ? toMealItem(updated) : null;
}

export async function getQuickAdd(limit = 6): Promise<QuickAddSuggestion[]> {
  const { rows } = await db.execute<{
    name: string;
    grams: string;
    kcal: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
  }>(sql`
    WITH recent AS (
      SELECT name, grams, kcal, protein_g, carbs_g, fat_g,
             ROW_NUMBER() OVER (PARTITION BY name ORDER BY logged_at DESC) AS rn,
             COUNT(*) OVER (PARTITION BY name) AS freq
      FROM ${foodLogEntry}
      WHERE logged_at > now() - INTERVAL '30 days'
        AND grams > 0
    )
    SELECT name, grams::text, kcal::text, protein_g::text, carbs_g::text, fat_g::text
    FROM recent
    WHERE rn = 1
    ORDER BY freq DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    name: r.name,
    grams: Number(r.grams),
    kcal: Number(r.kcal),
    proteinG: Number(r.protein_g),
    carbsG: Number(r.carbs_g),
    fatG: Number(r.fat_g),
  }));
}
