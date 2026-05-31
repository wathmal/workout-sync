import { NextRequest, NextResponse } from "next/server";
import { createRace, listAll, listByYear } from "@/lib/race/queries";
import type { RaceEventInput } from "@/lib/race/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get("year");
    if (yearParam !== null) {
      const year = Number(yearParam);
      if (!Number.isInteger(year)) {
        return NextResponse.json({ error: "year must be an integer" }, { status: 400 });
      }
      return NextResponse.json({ races: await listByYear(year) });
    }
    return NextResponse.json({ races: await listAll() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RaceEventInput;
    if (!isNonEmptyString(body?.name)) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    if (!isNonEmptyString(body?.date) || !ISO_DATE.test(body.date)) {
      return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
    }
    if (!isNonEmptyString(body?.category)) {
      return NextResponse.json({ error: "category required" }, { status: 400 });
    }
    const race = await createRace(body);
    return NextResponse.json({ race }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
