import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeMiniProgramCode, resolveMiniProgramUser } from "@/lib/work-cat/task-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUIDE_SELECT = "id,name,contact,source_url,has_guided_tour,guide_fee,guide_service_note,guide_source_url,guide_verified_at,opening_info,reservation_info,activity_formats,suitable_audiences,activity_route,nearby_base_combinations,activity_plan,related_materials,updated_at,is_published";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function usable(value: unknown) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return !result || result === "联系信息待核实" || result === "示范点信息待补充" ? null : result;
}

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "无效的基地编号。" }, 400);

  try {
    const admin = getSupabaseAdmin();
    const { data: base, error: baseError } = await admin
      .from("education_bases")
      .select(GUIDE_SELECT)
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (baseError) throw baseError;
    if (!base) return json({ error: "基地不存在或尚未发布。" }, 404);

    const preview = [
      "经核实的联系与预约信息",
      "开放与讲解服务",
      "适合开展的活动形式和人群",
      "活动路线与周边基地组合",
      "活动方案及相关资料"
    ];

    const code = request.headers.get("x-wx-code") || "";
    if (!code) return json({ bound: false, active: false, preview });

    const identity = await exchangeMiniProgramCode(code);
    const user = await resolveMiniProgramUser(identity);
    if (!user.bound) return json({ bound: false, active: false, preview });
    if (!user.active) return json({ bound: true, active: false, preview });

    return json({
      bound: true,
      active: true,
      preview,
      guide: {
        contact: usable(base.contact),
        openingInfo: usable(base.opening_info),
        reservationInfo: usable(base.reservation_info),
        officialSourceUrl: usable(base.source_url),
        guidedTour: base.has_guided_tour !== null || base.guide_fee || base.guide_service_note ? {
          available: base.has_guided_tour,
          fee: usable(base.guide_fee),
          note: usable(base.guide_service_note),
          sourceUrl: usable(base.guide_source_url),
          verifiedAt: base.guide_verified_at || null
        } : null,
        activityFormats: usable(base.activity_formats),
        suitableAudiences: usable(base.suitable_audiences),
        activityRoute: usable(base.activity_route),
        nearbyBaseCombinations: usable(base.nearby_base_combinations),
        activityPlan: usable(base.activity_plan),
        relatedMaterials: usable(base.related_materials),
        updatedAt: base.updated_at || null
      }
    });
  } catch (error) {
    console.error("[mini-base-guide] read failed", error);
    return json({ error: "基地攻略暂时无法读取。" }, 500);
  }
}
