import { NextRequest, NextResponse } from "next/server";
import { fmaAnalyzePhoto } from "@/lib/food/fma";
import {
  isHeic,
  convertHeicToJpeg,
  extractImageDateFromBuffer,
} from "@/lib/image-utils";

/**
 * Body: { imageBase64: string, filename?: string, mimeType?: string }
 * Returns: FMA analyze response + extracted EXIF date (if any).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const base64: string = body?.imageBase64 ?? "";
    const filename: string | undefined = body?.filename;
    const mimeType: string | undefined = body?.mimeType;

    if (!base64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
    }

    let buf: Buffer = Buffer.from(base64, "base64");
    if (isHeic(mimeType, filename, buf)) {
      buf = await convertHeicToJpeg(buf) as Buffer;
    }

    const exifDate = await extractImageDateFromBuffer(buf).catch(() => null);
    const forwardedBase64 = buf.toString("base64");

    const analyze = await fmaAnalyzePhoto(forwardedBase64);

    return NextResponse.json({
      ...analyze,
      exifDate: exifDate ? exifDate.toISOString() : null,
    });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: (err as Error).message },
      { status: status === 401 ? 502 : status },
    );
  }
}
