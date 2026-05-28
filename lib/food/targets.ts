import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { macroTarget, type MacroTargetInsert } from "./schema";
import type { MacroTarget } from "./types";

function userTz(): string {
  return process.env.USER_TZ ?? "UTC";
}

/** Today as YYYY-MM-DD in USER_TZ. */
export function todayInUserTz(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: userTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function getCurrentTarget(): Promise<MacroTarget | null> {
  const today = todayInUserTz();
  const { rows } = await db.execute<{
    id: string;
    start_date: string;
    end_date: string | null;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    note: string | null;
  }>(sql`
    SELECT id, start_date, end_date, kcal, protein_g, carbs_g, fat_g, note
    FROM ${macroTarget}
    WHERE start_date <= ${today}::date
      AND (end_date IS NULL OR end_date >= ${today}::date)
    ORDER BY start_date DESC
    LIMIT 1
  `);

  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    kcal: r.kcal,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    note: r.note,
  };
}

/**
 * Insert a new target. Any prior target whose range overlaps the new
 * start_date is auto-closed by setting its end_date = new.start_date - 1.
 *
 * Not wired to a route in MVP — call from a seed/admin script.
 */
export async function insertTargetWithAutoClose(
  input: Omit<MacroTargetInsert, "id" | "createdAt">,
): Promise<MacroTarget> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE ${macroTarget}
      SET end_date = ${input.startDate}::date - INTERVAL '1 day'
      WHERE start_date <= ${input.startDate}::date
        AND (end_date IS NULL OR end_date >= ${input.startDate}::date)
    `);

    const { rows } = await tx.execute<{
      id: string;
      start_date: string;
      end_date: string | null;
      kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      note: string | null;
    }>(sql`
      INSERT INTO ${macroTarget}
        (start_date, end_date, kcal, protein_g, carbs_g, fat_g, note)
      VALUES
        (${input.startDate}::date, ${input.endDate ?? null},
         ${input.kcal}, ${input.proteinG}, ${input.carbsG}, ${input.fatG},
         ${input.note ?? null})
      RETURNING id, start_date, end_date, kcal, protein_g, carbs_g, fat_g, note
    `);

    const r = rows[0];
    return {
      id: r.id,
      startDate: r.start_date,
      endDate: r.end_date,
      kcal: r.kcal,
      proteinG: r.protein_g,
      carbsG: r.carbs_g,
      fatG: r.fat_g,
      note: r.note,
    };
  });
}
