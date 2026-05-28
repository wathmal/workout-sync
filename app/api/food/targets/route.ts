import { NextResponse } from "next/server";
import { getCurrentTarget } from "@/lib/food/targets";

export async function GET() {
  try {
    const target = await getCurrentTarget();
    return NextResponse.json({ target });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
