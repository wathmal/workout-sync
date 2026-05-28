import { NextRequest, NextResponse } from "next/server";
import { fmaAnalyzeText } from "@/lib/food/fma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body?.text ?? "").toString().trim();
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }
    const data = await fmaAnalyzeText(text);
    return NextResponse.json(data);
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
