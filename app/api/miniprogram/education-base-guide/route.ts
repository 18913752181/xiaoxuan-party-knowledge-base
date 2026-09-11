import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeMiniProgramCode, resolveMiniProgramUser } from "@/lib/work-cat/task-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GUIDE_SELECT = "id,name,contact,source_url,has_guided_tour,guide_fee,guide_service_note,guide_source_url,guide_verified_at,opening_info,reservation_info,activity_formats,activity_route,nearby_base_combinations,related_materials,updated_at,is_published";

type RouteNode = { time: string | null; title: string; note: string | null; baseId: number | null };
type NearbyInput = { baseId: number; note: string | null };
type MaterialLink = { title: string; url: string; description: string | null };

const preview = [
  { title: "参观联系", description: "联系方式、预约方式与开放提示" },
  { title: "讲解服务", description: "讲解预约、费用与场次信息" },
  { title: "活动路线", description: "半日、一日及周边联动路线" },
  { title: "配套方案与资料", description: "关联小宣资料库现有内容" },
  { title: "基地使用提示", description: "宣知整理的简短组织建议" }
];

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function usable(value: unknown) {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return !result || result === "联系信息待核实" || result === "示范点信息待补充" ? null : result;
}

function parsed(value: unknown): unknown {
  const content = usable(value);
  if (!content) return null;
  try { return JSON.parse(content); } catch { return content; }
}

function positiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function routeNode(value: unknown): RouteNode | null {
  if (typeof value === "string") {
    const title = usable(value);
    return title ? { time: null, title, note: null, baseId: null } : null;
  }
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = usable(item.title || item.name);
  if (!title) return null;
  return { time: usable(item.time), title, note: usable(item.note || item.description), baseId: positiveId(item.baseId || item.base_id) };
}

function routeNodes(value: unknown) {
  return (Array.isArray(value) ? value : []).map(routeNode).filter((item): item is RouteNode => Boolean(item));
}

function routePlan(value: unknown) {
  const data = parsed(value);
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const item = data as Record<string, unknown>;
    return { halfDay: routeNodes(item.halfDay || item.half_day), fullDay: routeNodes(item.fullDay || item.full_day), note: usable(item.note) };
  }
  return { halfDay: [], fullDay: [], note: typeof data === "string" ? data : null };
}

function nearbyInputs(value: unknown): { items: NearbyInput[]; note: string | null } {
  const data = parsed(value);
  if (!Array.isArray(data)) return { items: [], note: typeof data === "string" ? data : null };
  const items = data.map((value) => {
    const item: Record<string, unknown> = typeof value === "object" && value ? value as Record<string, unknown> : { baseId: value };
    const baseId = positiveId(item.baseId || item.base_id || item.id);
    return baseId ? { baseId, note: usable(item.note || item.description) } : null;
  }).filter((item): item is NearbyInput => Boolean(item));
  return { items, note: null };
}

function materialLinks(value: unknown): MaterialLink[] {
  const data = parsed(value);
  const values = Array.isArray(data) ? data : typeof data === "string" ? data.split(/\r?\n/).filter(Boolean) : [];
  return values.map((value) => {
    if (typeof value === "string") {
      const parts = value.split(/[|｜]/).map((part) => part.trim());
      const url = parts.find((part) => /^https:\/\/(?:www\.)?xiaoxuanvip\.com(?:\/|$)/i.test(part));
      return url ? { title: parts[0] === url ? "相关资料" : parts[0], url, description: parts.find((part, index) => index > 0 && part !== url) || null } : null;
    }
    if (!value || typeof value !== "object") return null;
    const item = value as Record<string, unknown>;
    const url = usable(item.url);
    const title = usable(item.title || item.name);
    if (!url || !title || !/^https:\/\/(?:www\.)?xiaoxuanvip\.com(?:\/|$)/i.test(url)) return null;
    return { title, url, description: usable(item.description || item.note) };
  }).filter((item): item is MaterialLink => Boolean(item));
}

function usageTips(value: unknown) {
  const data = parsed(value);
  const values = Array.isArray(data) ? data : typeof data === "string" ? data.split(/[\r\n,，;；]+/) : [];
  return values.map(usable).filter((item): item is string => Boolean(item)).slice(0, 5);
}

export async function GET(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "无效的基地编号。" }, 400);

  try {
    const admin = getSupabaseAdmin();
    const { data: base, error: baseError } = await admin.from("education_bases").select(GUIDE_SELECT).eq("id", id).eq("is_published", true).maybeSingle();
    if (baseError) throw baseError;
    if (!base) return json({ error: "基地不存在或尚未发布。" }, 404);

    const code = request.headers.get("x-wx-code") || "";
    if (!code) return json({ bound: false, active: false, preview });
    const identity = await exchangeMiniProgramCode(code);
    const user = await resolveMiniProgramUser(identity);
    if (!user.bound) return json({ bound: false, active: false, preview });
    if (!user.active) return json({ bound: true, active: false, preview });

    const routes = routePlan(base.activity_route);
    const nearbyInput = nearbyInputs(base.nearby_base_combinations);
    const nearbyIds = Array.from(new Set(nearbyInput.items.map((item) => item.baseId)));
    let nearby: Array<{ id: number; name: string; note: string | null }> = [];
    if (nearbyIds.length) {
      const { data, error } = await admin.from("education_bases").select("id,name").in("id", nearbyIds).eq("is_published", true);
      if (error) throw error;
      const names = new Map((data || []).map((item) => [Number(item.id), String(item.name)]));
      nearby = nearbyInput.items.filter((item) => names.has(item.baseId)).map((item) => ({ id: item.baseId, name: names.get(item.baseId)!, note: item.note }));
    }

    return json({
      bound: true,
      active: true,
      preview,
      guide: {
        officialFacts: {
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
          } : null
        },
        editorialAdvice: {
          label: "宣知整理建议",
          routes: { ...routes, nearby, nearbyNote: nearbyInput.note },
          materials: materialLinks(base.related_materials),
          usageTips: usageTips(base.activity_formats)
        },
        updatedAt: base.updated_at || null
      }
    });
  } catch (error) {
    console.error("[mini-base-guide] read failed", error);
    return json({ error: "基地攻略暂时无法读取。" }, 500);
  }
}
