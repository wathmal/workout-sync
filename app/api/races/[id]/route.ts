import { NextRequest, NextResponse } from "next/server";
import { deleteRace, updateRace } from "@/lib/race/queries";
import type { RaceEventPatch } from "@/lib/race/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as RaceEventPatch;
    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
      return NextResponse.json({ error: "name must be non-empty" }, { status: 400 });
    }
    if (body.date !== undefined && (typeof body.date !== "string" || !ISO_DATE.test(body.date))) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }
    if (body.category !== undefined && (typeof body.category !== "string" || !body.category.trim())) {
      return NextResponse.json({ error: "category must be non-empty" }, { status: 400 });
    }
    const race = await updateRace(id, body);
    if (!race) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ race });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const ok = await deleteRace(id);
    if (!ok) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
