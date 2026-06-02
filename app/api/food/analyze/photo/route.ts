import { NextRequest, NextResponse } from "next/server";
import { fmaAnalyzePhoto } from "@/lib/food/fma";
import { preparePhoto } from "@/lib/food/photo-prep";

/**
 * Body: { imageBase64, filename?, mimeType?, locale?, context? }
 * Returns: FMA analyze response + extracted EXIF date (if any).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base64: string = body?.imageBase64 ?? "";
    const filename: string | undefined = body?.filename;
    const mimeType: string | undefined = body?.mimeType;
    const locale: string | undefined = body?.locale;
    const context: string | undefined = body?.context;
    const capturedAt: string | null | undefined = body?.capturedAt;

    if (!base64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    const prepared = await preparePhoto(base64, filename, mimeType, capturedAt);
    const analyze = await fmaAnalyzePhoto(prepared.base64, { locale, context });

    return NextResponse.json({
      ...analyze,
      exifDate: prepared.exifDateIso,
      // HEIC is unrenderable in <img>; hand back the transcoded JPEG so the
      // client can swap it into the preview (matches the workout flow).
      convertedImageBase64: prepared.converted ? prepared.base64 : undefined,
    });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
