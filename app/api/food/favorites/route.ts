import { NextResponse } from "next/server";
import { addFavorite, getFavorites, removeFavorite } from "@/lib/food/queries";

export async function GET() {
  try {
    const items = await getFavorites();
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { batchId?: string };
    if (!body.batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }
    const favorite = await addFavorite(body.batchId);
    return NextResponse.json({ favorite });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const removed = await removeFavorite(id);
    return NextResponse.json({ ok: removed > 0 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
