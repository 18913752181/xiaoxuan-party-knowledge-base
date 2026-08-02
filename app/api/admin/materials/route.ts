import { NextResponse } from "next/server";
import { contentUnitToMaterial, listContentUnits, updateContentUnitMeta, updateContentUnitOrder } from "@/lib/content-units";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const units = await listContentUnits({ includeHidden: true });
  return withAuthCookies(check.session, NextResponse.json(units.map(contentUnitToMaterial)));
}

export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

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

  return withAuthCookies(check.session, NextResponse.json({ ok: true, materials: updated }));
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const body = await request.json().catch(() => null);
  const slugs = Array.isArray(body?.slugs)
    ? body.slugs.map((slug: unknown) => String(slug || "").trim()).filter(Boolean)
    : [];

  if (!slugs.length) {
    return NextResponse.json({ error: "请提供需要保存的资料顺序。" }, { status: 400 });
  }

  const existingUnits = await listContentUnits({ includeHidden: true });
  const existingSlugs = new Set(existingUnits.map((unit) => unit.slug));
  const requestedSlugs = Array.from(new Set<string>(slugs));

  if (requestedSlugs.length !== slugs.length) {
    return NextResponse.json({ error: "资料顺序中出现重复项，请刷新后重新排序。" }, { status: 400 });
  }

  if (requestedSlugs.length !== existingUnits.length || requestedSlugs.some((slug) => !existingSlugs.has(slug))) {
    return NextResponse.json({ error: "资料列表已发生变化，请刷新后重新排序。" }, { status: 409 });
  }

  const units = await updateContentUnitOrder(requestedSlugs);
  return withAuthCookies(check.session, NextResponse.json({ ok: true, materials: units.map(contentUnitToMaterial) }));
}
