import { NextRequest, NextResponse } from "next/server";
import { fmaSearch } from "@/lib/food/fma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(50, Number(limitParam))) : 8;
  const pageParam = request.nextUrl.searchParams.get("page");
  const page = pageParam ? Math.max(1, Number(pageParam)) : 1;
  const locale = request.nextUrl.searchParams.get("locale")?.trim() || undefined;

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const data = await fmaSearch(q, limit, { locale, page });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
