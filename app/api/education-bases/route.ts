import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  EDUCATION_BASE_SELECT,
  getFallbackEducationBases,
  toPublicEducationBase,
  type EducationBaseRow
} from "@/lib/education-bases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let rows: EducationBaseRow[] = [];
  let source: "database" | "fallback" = "database";

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("education_bases")
      .select(EDUCATION_BASE_SELECT)
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    rows = (data || []) as EducationBaseRow[];
  } catch (error) {
    console.warn("教育基地接口使用不含地图位置的本地兜底数据", error);
    // 正式地图位置只来自 education_bases；数据库不可用时宁可不展示地图点，也不回退到历史静态坐标。
    rows = getFallbackEducationBases().map((row) => ({
      ...row,
      address: null,
      latitude: null,
      longitude: null,
      coordinate_type: null,
      location_source_name: null,
      location_source_url: null,
      location_confidence: "pending" as const
    }));
    source = "fallback";
  }

  return NextResponse.json({
    bases: rows.map(toPublicEducationBase),
    total: rows.length,
    source,
    generatedAt: new Date().toISOString()
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}
