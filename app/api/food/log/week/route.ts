import { NextRequest, NextResponse } from "next/server";
import { getWeek } from "@/lib/food/queries";

export async function GET(request: NextRequest) {
  try {
    const date = request.nextUrl.searchParams.get("date") ?? undefined;
    const week = await getWeek(date);
    return NextResponse.json({ week });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
