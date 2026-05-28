import { NextRequest, NextResponse } from "next/server";
import { editGrams } from "@/lib/food/queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const grams = Number(body?.grams);
    if (!Number.isFinite(grams) || grams <= 0) {
      return NextResponse.json({ error: "grams must be > 0" }, { status: 400 });
    }
    const updated = await editGrams(itemId, grams);
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
