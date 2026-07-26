import { NextResponse } from "next/server";
import { contentUnitToMaterial, listContentUnits, updateContentUnitMeta } from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const units = await listContentUnits({ includeHidden: true });
  return NextResponse.json(units.map(contentUnitToMaterial));
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const slugs: string[] = Array.isArray(body?.slugs)
    ? Array.from(new Set<string>(body.slugs.map((slug: unknown) => String(slug || "").trim()).filter(Boolean)))
    : [];

  if (!slugs.length || typeof body?.memberOnly !== "boolean") {
    return NextResponse.json({ error: "请选择资料并指定会员状态。" }, { status: 400 });
  }

  const updated = [];
  for (const slug of slugs) {
    const unit = await updateContentUnitMeta(slug, { isVip: body.memberOnly });
    if (unit) updated.push(contentUnitToMaterial(unit));
  }

  if (!updated.length) {
    return NextResponse.json({ error: "没有找到可修改的资料。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, materials: updated });
}
