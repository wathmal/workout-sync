import { NextResponse } from "next/server";
import { getCurrentWeek } from "@/lib/food/queries";

export async function GET() {
  try {
    const week = await getCurrentWeek();
    return NextResponse.json({ week });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
