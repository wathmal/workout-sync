import { NextRequest, NextResponse } from "next/server";
import { fmaAnalyzeBarcode } from "@/lib/food/fma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = (body?.code ?? "").toString().trim();
    const locale: string | undefined = body?.locale || undefined;
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
    const data = await fmaAnalyzeBarcode(code, { locale });
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
