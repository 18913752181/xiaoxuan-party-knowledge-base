import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { searchTencentPois, scoreTencentPoi } from "@/lib/tencent-poi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_COLUMNS = "id,name,type,city,district,address,latitude,longitude,location_confidence";
const CANDIDATE_COLUMNS = "id,review_id,candidate_rank,poi_id,poi_name,address,latitude,longitude,city,district,poi_category,name_similarity,city_match,district_match,match_score,confidence_level,is_reasonable_category";

function internalAuthorized(request: Request) {
  const secret = process.env.REMINDER_CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || "腾讯位置服务核验失败");
  if (message.includes("education_base_location_")) return "腾讯位置服务核验数据表尚未建立，请先执行 supabase/043_education_base_tencent_location_reviews.sql。";
  return message;
}

async function reviews(admin: ReturnType<typeof getSupabaseAdmin>) {
  const { data: locationReviews, error } = await admin
    .from("education_base_location_reviews")
    .select("id,base_id,search_query,status,selected_candidate_id,last_error,searched_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const reviewIds = (locationReviews || []).map((item) => item.id);
  if (!reviewIds.length) return [];
  const { data: candidates, error: candidateError } = await admin
    .from("education_base_location_candidates")
    .select(CANDIDATE_COLUMNS)
    .in("review_id", reviewIds)
    .order("candidate_rank", { ascending: true });
  if (candidateError) throw candidateError;
  return (locationReviews || []).map((review) => ({
    ...review,
    education_base_location_candidates: (candidates || []).filter((candidate) => candidate.review_id === review.id)
  }));
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const admin = getSupabaseAdmin();
    const [{ data: bases, error: baseError }, locationReviews] = await Promise.all([
      admin.from("education_bases").select(BASE_COLUMNS).order("sort_order").order("id"),
      reviews(admin)
    ]);
    if (baseError) throw baseError;
    return withAuthCookies(check.session, NextResponse.json({ bases: bases || [], reviews: locationReviews }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: errorMessage(error) }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const isInternal = internalAuthorized(request);
  const check = isInternal ? null : await requireAdmin();
  if (check && !check.ok) return check.response;
  const respond = (response: NextResponse) => check && check.ok ? withAuthCookies(check.session, response) : response;
  try {
    const body = await request.json() as { baseIds?: unknown };
    const ids = Array.isArray(body.baseIds) ? Array.from(new Set(body.baseIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))) : [];
    if (!ids.length || ids.length > 5) return respond(NextResponse.json({ error: "每次只允许检索 1 到 5 条基地。" }, { status: 400 }));
    const admin = getSupabaseAdmin();
    const { data: bases, error } = await admin.from("education_bases").select(BASE_COLUMNS).in("id", ids);
    if (error) throw error;
    if ((bases || []).length !== ids.length) return respond(NextResponse.json({ error: "部分基地不存在。" }, { status: 404 }));
    const outcomes = [] as Array<{ baseId: number; baseName: string; result: string; current?: { address: string | null; latitude: number | null; longitude: number | null }; selected?: Record<string, unknown> }>;
    for (const base of bases || []) {
      const complete = Boolean(base.address && base.latitude !== null && base.longitude !== null);
      const current = { address: base.address, latitude: base.latitude, longitude: base.longitude };
      const searchQuery = `${base.name} ${base.city} ${base.district}`;
      try {
        const pois = await searchTencentPois(base);
        const { data: review, error: reviewError } = await admin.from("education_base_location_reviews").upsert({ base_id: base.id, search_query: searchQuery, status: pois.length ? "needs_review" : "not_found", last_error: null, searched_at: new Date().toISOString() }, { onConflict: "base_id" }).select("id").single();
        if (reviewError) throw reviewError;
        const { error: deleteError } = await admin.from("education_base_location_candidates").delete().eq("review_id", review.id);
        if (deleteError) throw deleteError;
        const candidates = pois.map((poi, index) => {
          const match = scoreTencentPoi(base, poi);
          return { poi, match, row: { review_id: review.id, candidate_rank: index + 1, poi_id: poi.poiId, poi_name: poi.name, address: poi.address, latitude: poi.latitude, longitude: poi.longitude, city: poi.city, district: poi.district, poi_category: poi.category, name_similarity: match.nameSimilarity, city_match: match.cityMatch, district_match: match.districtMatch, match_score: match.score, confidence_level: match.confidence, is_reasonable_category: match.categoryMatch } };
        });
        if (candidates.length) {
          const { data: inserted, error: insertError } = await admin.from("education_base_location_candidates").insert(candidates.map((candidate) => candidate.row)).select("id,candidate_rank,match_score");
          if (insertError) throw insertError;
          const best = [...candidates].sort((left, right) => right.match.score - left.match.score)[0];
          const selected = inserted?.find((item) => item.candidate_rank === best.row.candidate_rank);
          const closeAlternatives = candidates.filter((candidate) => candidate !== best && candidate.match.nameSimilarity >= 0.82 && candidate.match.score >= best.match.score - 8);
          const locationWasEntirelyEmpty = !base.address && base.latitude === null && base.longitude === null;
          if (selected && best.match.autoMatch && closeAlternatives.length === 0 && locationWasEntirelyEmpty && base.location_confidence !== "verified" && best.poi.address && best.poi.latitude !== null && best.poi.longitude !== null) {
            const { error: locationError } = await admin.from("education_bases").update({ address: best.poi.address, latitude: best.poi.latitude, longitude: best.poi.longitude, coordinate_type: "gcj02", location_source_name: "腾讯位置服务 POI", location_source_url: "https://lbs.qq.com/", location_confidence: "probable" }).eq("id", base.id).neq("location_confidence", "verified");
            if (locationError) throw locationError;
            await admin.from("education_base_location_reviews").update({ status: "auto_matched", selected_candidate_id: selected.id }).eq("id", review.id);
            outcomes.push({ baseId: base.id, baseName: base.name, result: "auto_matched", current, selected: best.row });
          } else {
            await admin.from("education_base_location_reviews").update({ status: pois.length ? "needs_review" : "not_found", selected_candidate_id: selected?.id || null }).eq("id", review.id);
            outcomes.push({ baseId: base.id, baseName: base.name, result: pois.length ? (complete ? "checked_existing" : "needs_review") : "not_found", current, selected: best.row });
          }
        } else outcomes.push({ baseId: base.id, baseName: base.name, result: "not_found", current });
      } catch (lookupError) {
        await admin.from("education_base_location_reviews").upsert({ base_id: base.id, search_query: searchQuery, status: "failed", last_error: errorMessage(lookupError), searched_at: new Date().toISOString() }, { onConflict: "base_id" });
        outcomes.push({ baseId: base.id, baseName: base.name, result: "failed" });
      }
    }
    revalidatePath("/api/education-bases");
    const summary = {
      autoMatched: outcomes.filter((item) => item.result === "auto_matched").length,
      checkedExisting: outcomes.filter((item) => item.result === "checked_existing").length,
      needsReview: outcomes.filter((item) => item.result === "needs_review").length,
      notFound: outcomes.filter((item) => item.result === "not_found").length,
      failed: outcomes.filter((item) => item.result === "failed").length
    };
    return respond(NextResponse.json({ outcomes, summary }));
  } catch (error) {
    return respond(NextResponse.json({ error: errorMessage(error) }, { status: 500 }));
  }
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const body = await request.json() as { baseId?: unknown; candidateId?: unknown; action?: unknown; manual?: { address?: unknown; latitude?: unknown; longitude?: unknown } };
    const baseId = Number(body.baseId);
    const candidateId = Number(body.candidateId);
    if (!Number.isInteger(baseId) || !Number.isInteger(candidateId)) return NextResponse.json({ error: "基地和候选项不能为空。" }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data: review, error: reviewError } = await admin.from("education_base_location_reviews").select("id").eq("base_id", baseId).single();
    if (reviewError) throw reviewError;
    const { data: candidate, error: candidateError } = await admin.from("education_base_location_candidates").select("id,poi_id,address,latitude,longitude").eq("id", candidateId).eq("review_id", review.id).single();
    if (candidateError) throw candidateError;
    const manual = body.manual || {};
    const address = typeof manual.address === "string" && manual.address.trim() ? manual.address.trim() : candidate.address;
    const latitude = manual.latitude === undefined || manual.latitude === "" ? candidate.latitude : Number(manual.latitude);
    const longitude = manual.longitude === undefined || manual.longitude === "" ? candidate.longitude : Number(manual.longitude);
    if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return NextResponse.json({ error: "确认前需要完整地址、纬度和经度。" }, { status: 400 });
    const action = body.action === "manual" ? "manual" : body.action === "select" ? "select" : "confirm";
    if (action === "select") {
      await admin.from("education_base_location_reviews").update({ selected_candidate_id: candidate.id, status: "needs_review" }).eq("id", review.id);
      return withAuthCookies(check.session, NextResponse.json({ ok: true }));
    }
    const { data: base, error: baseError } = await admin.from("education_bases").select("address,latitude,longitude,location_confidence").eq("id", baseId).single();
    if (baseError) throw baseError;
    const existingComplete = base.address && base.latitude !== null && base.longitude !== null;
    if (existingComplete && base.location_confidence === "verified") {
      return withAuthCookies(check.session, NextResponse.json({ error: "该基地已有确认位置，本功能不会覆盖。" }, { status: 409 }));
    }
    const { error: updateError } = await admin.from("education_bases").update({ address, latitude, longitude, coordinate_type: "gcj02", location_source_name: action === "manual" ? "腾讯位置服务 POI（人工修订）" : "腾讯位置服务 POI（人工确认）", location_source_url: "https://lbs.qq.com/", location_confidence: "verified" }).eq("id", baseId);
    if (updateError) throw updateError;
    await admin.from("education_base_location_reviews").update({ selected_candidate_id: candidate.id, status: action === "manual" ? "manual_confirmed" : "confirmed" }).eq("id", review.id);
    revalidatePath("/api/education-bases");
    return withAuthCookies(check.session, NextResponse.json({ ok: true, previousLocation: base }));
  } catch (error) {
    return withAuthCookies(check.session, NextResponse.json({ error: errorMessage(error) }, { status: 500 }));
  }
}
