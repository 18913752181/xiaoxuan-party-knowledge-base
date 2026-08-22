import { NextResponse } from "next/server";
import { contentUnitToMaterial, getContentUnitBySlug } from "@/lib/content-units";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const slug = params.id.replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);
  if (!unit) {
    return NextResponse.json({ error: "没有找到知识单元。" }, { status: 404 });
  }
  return NextResponse.json(contentUnitToMaterial(unit), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }
  });
}
