import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { raceEvent, type RaceEventInsert, type RaceEventRow } from "@/lib/db/schema/race";
import type { RaceEvent, RaceEventInput, RaceEventPatch } from "./types";

function toRaceEvent(r: RaceEventRow): RaceEvent {
  return {
    id: r.id,
    name: r.name,
    date: r.date, // drizzle `date` column → 'YYYY-MM-DD' string
    category: r.category,
    eventTarget: r.eventTarget,
    location: r.location,
    note: r.note,
    resultTime: r.resultTime,
    resultPlacement: r.resultPlacement,
    resultNote: r.resultNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listAll(): Promise<RaceEvent[]> {
  const rows = await db.select().from(raceEvent).orderBy(asc(raceEvent.date));
  return rows.map(toRaceEvent);
}

export async function listByYear(year: number): Promise<RaceEvent[]> {
  const rows = await db
    .select()
    .from(raceEvent)
    .where(sql`extract(year from ${raceEvent.date}) = ${year}`)
    .orderBy(asc(raceEvent.date));
  return rows.map(toRaceEvent);
}

export async function createRace(input: RaceEventInput): Promise<RaceEvent> {
  const [row] = await db
    .insert(raceEvent)
    .values({
      name: input.name,
      date: input.date,
      category: input.category,
      eventTarget: input.eventTarget ?? null,
      location: input.location ?? null,
      note: input.note ?? null,
      resultTime: input.resultTime ?? null,
      resultPlacement: input.resultPlacement ?? null,
      resultNote: input.resultNote ?? null,
    })
    .returning();
  if (!row) throw new Error("createRace: insert returned no row");
  return toRaceEvent(row);
}

export async function updateRace(
  id: string,
  patch: RaceEventPatch,
): Promise<RaceEvent | null> {
  const set: Partial<RaceEventInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.date !== undefined) set.date = patch.date;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.eventTarget !== undefined) set.eventTarget = patch.eventTarget ?? null;
  if (patch.location !== undefined) set.location = patch.location ?? null;
  if (patch.note !== undefined) set.note = patch.note ?? null;
  if (patch.resultTime !== undefined) set.resultTime = patch.resultTime ?? null;
  if (patch.resultPlacement !== undefined)
    set.resultPlacement = patch.resultPlacement ?? null;
  if (patch.resultNote !== undefined) set.resultNote = patch.resultNote ?? null;

  const [row] = await db
    .update(raceEvent)
    .set(set)
    .where(eq(raceEvent.id, id))
    .returning();
  return row ? toRaceEvent(row) : null;
}

export async function deleteRace(id: string): Promise<boolean> {
  const rows = await db
    .delete(raceEvent)
    .where(eq(raceEvent.id, id))
    .returning({ id: raceEvent.id });
  return rows.length > 0;
}
