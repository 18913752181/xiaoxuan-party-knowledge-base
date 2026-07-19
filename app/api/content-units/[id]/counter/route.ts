import { NextResponse } from "next/server";
import { updateContentUnitCounter } from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const slug = params.id.replace(/^content-/, "");
  const payload = await request.json().catch(() => ({}));
  const field = payload.field;
  const delta = payload.delta;

  if ((field !== "downloadCount" && field !== "favoriteCount") || (delta !== 1 && delta !== -1)) {
    return NextResponse.json({ error: "计数字段或变化值无效。" }, { status: 400 });
  }

  const value = await updateContentUnitCounter(slug, field, delta);
  if (value === null) {
    return NextResponse.json({ error: "没有找到知识单元。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, field, value });
}
