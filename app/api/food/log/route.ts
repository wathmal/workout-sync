import { NextRequest, NextResponse } from "next/server";
import { deleteBatch, getDay, insertBatch } from "@/lib/food/queries";
import type { MealBatchInput } from "@/lib/food/types";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const items = await getDay(date);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

const ALLOWED_SOURCES = new Set(["search", "text", "photo", "manual"]);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MealBatchInput;
    if (!body?.items?.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }
    if (!body.source || !ALLOWED_SOURCES.has(body.source)) {
      return NextResponse.json({ error: "valid source required" }, { status: 400 });
    }
    if (!body.loggedAt) {
      return NextResponse.json({ error: "loggedAt required" }, { status: 400 });
    }
    const loggedAtMs = Date.parse(body.loggedAt);
    if (!Number.isFinite(loggedAtMs)) {
      return NextResponse.json({ error: "loggedAt must be a valid ISO timestamp" }, { status: 400 });
    }
    for (const [i, it] of body.items.entries()) {
      if (!it || typeof it.name !== "string" || !it.name.trim()) {
        return NextResponse.json({ error: `items[${i}].name required` }, { status: 400 });
      }
      if (!isFiniteNumber(it.grams) || it.grams <= 0) {
        return NextResponse.json(
          { error: `items[${i}].grams must be > 0 (got ${String(it.grams)})` },
          { status: 400 },
        );
      }
      for (const k of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
        const v = it[k];
        if (!isFiniteNumber(v) || v < 0) {
          return NextResponse.json(
            { error: `items[${i}].${k} must be a finite non-negative number (got ${String(v)})` },
            { status: 400 },
          );
        }
      }
    }
    const items = await insertBatch(body);
    return NextResponse.json({ items }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const batchId = request.nextUrl.searchParams.get("batch_id");
    if (!batchId) {
      return NextResponse.json({ error: "batch_id required" }, { status: 400 });
    }
    const deleted = await deleteBatch(batchId);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
