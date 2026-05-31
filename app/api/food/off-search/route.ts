import { NextRequest, NextResponse } from "next/server";
import { fmaOffSearch } from "@/lib/food/fma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(50, Number(limitParam))) : 10;

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const data = await fmaOffSearch(q, limit);
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
