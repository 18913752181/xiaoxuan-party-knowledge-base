import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMaterialPointState } from "@/lib/material-point-state";
import { quoteMaterialPoints } from "@/lib/material-point-view";
import { getContentUnitBySlug, getContentUnitDownloadFilePath } from "@/lib/content-units";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function respond(request?: Request) {
  const session = await getServerSession();
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  if (!session) return finish({ error: "请先登录。" }, 401);
  try {
    const state = await getMaterialPointState(session.user.id);
    if (!request) return finish(state);
    if (state.policy === "annual_daily" && !state.canDownload) return finish({ error: "新会员仅年卡可下载资料，月卡和季卡不含资料库下载权限。", code: "ANNUAL_MEMBERSHIP_REQUIRED" }, 403);
    const body = await request.json().catch(() => ({}));
    const batch = body.batch !== false;
    if (batch && !state.paid) return finish({ error: "批量下载仅限付费会员。", code: "BATCH_MEMBERSHIP_REQUIRED" }, 403);
    if (!batch && (!Array.isArray(body.slugs) || body.slugs.length !== 1)) return finish({ error: "请选择一份资料。" }, 400);
    if (!Array.isArray(body.slugs) || !body.slugs.length || body.slugs.length > 50 || body.slugs.some((slug: unknown) => typeof slug !== "string" || !slug || slug.length > 500)) {
      return finish({ error: "请每次选择 1 至 50 份资料。" }, 400);
    }
    const items = [];
    for (const slug of Array.from(new Set<string>(body.slugs.map((s: string) => s.replace(/^content-/, ""))))) {
      const unit = await getContentUnitBySlug(slug);
      if (!unit || !(await getContentUnitDownloadFilePath(slug))) return finish({ error: "所选资料文件已移除或尚未上传，请刷新后重试。" }, 404);
      if (unit.meta.isVip && !state.paid) return finish({ error: "该资料为会员专属，请开通会员后下载。", code: "MEMBERSHIP_REQUIRED" }, 403);
      items.push({ slug, cost: unit.meta.pointsCost });
    }
    return finish(quoteMaterialPoints(state, items));
  } catch {
    return finish({ error: "积分信息暂时无法核验，请稍后重试。" }, 503);
  }
}
export function GET() { return respond(); }
export function POST(request: Request) { return respond(request); }
