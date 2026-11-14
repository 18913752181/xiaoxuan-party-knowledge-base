import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { contentUnitToMaterial, listContentUnits, updateContentUnitMeta, updateContentUnitOrder } from "@/lib/content-units";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function revalidatePublicMaterialLists() {
  revalidatePath("/library");
  revalidatePath("/library/materials");
}

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
  if (typeof body?.memberOnly !== "boolean" || !Array.isArray(body.slugs) ||
      !body.slugs.length || body.slugs.some((slug: unknown) => typeof slug !== "string" || !slug.trim())) {
    return withAuthCookies(check.session, NextResponse.json({ error: "请选择资料并指定会员分类。" }, { status: 400 }));
  }

  const slugs = Array.from(new Set<string>(body.slugs.map((slug: string) => slug.trim())));
  const updatedSlugs: string[] = [];
  for (const slug of slugs) {
    try {
      if (await updateContentUnitMeta(slug, { isVip: body.memberOnly })) updatedSlugs.push(slug);
    } catch (error) {
      console.error("Failed to update material classification", slug, error);
    }
  }

  if (updatedSlugs.length) revalidatePublicMaterialLists();
  return withAuthCookies(check.session, NextResponse.json({ updatedSlugs }));
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
  revalidatePublicMaterialLists();
  return withAuthCookies(check.session, NextResponse.json({ ok: true, materials: units.map(contentUnitToMaterial) }));
}
