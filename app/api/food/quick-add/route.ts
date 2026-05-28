import { NextResponse } from "next/server";
import { getQuickAdd } from "@/lib/food/queries";

export async function GET() {
  try {
    const items = await getQuickAdd();
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
