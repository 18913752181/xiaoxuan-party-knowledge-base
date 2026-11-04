import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getContentUnitBySlug, getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";
import { materialClaimError } from "@/lib/material-download-message";
import { claimMaterialPoints } from "@/lib/material-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeDownloadName(name: string) {
  return encodeURIComponent(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-"));
}

function contentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function downloadFileName(headerName: string) {
  const encoded = encodeDownloadName(headerName);
  return `attachment; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 });
  }

  const expected = new URL(request.url).searchParams.get("expectedPoints");
  const expectedPoints = expected === null ? undefined : Number(expected);
  if (expectedPoints !== undefined && (!Number.isInteger(expectedPoints) || expectedPoints < 0)) return NextResponse.json({ error: "积分确认参数无效，请重新确认下载。" }, { status: 400 });
  const slug = decodeURIComponent(params.id).replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);
  if (!unit) return NextResponse.json({ error: "没有找到资料。" }, { status: 404 });

  if (unit.meta.isVip) {
    try {
      const membership = await getMembership(session.user.id, session.accessToken);
      if (!membership.active) {
        const response = NextResponse.json(
          { error: "该资料为会员专属，仅付费会员可下载。", code: "MEMBERSHIP_REQUIRED" },
          { status: 403, headers: { "Cache-Control": "private, no-store" } }
        );
        if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
        return response;
      }
    } catch {
      return NextResponse.json(
        { error: "会员状态暂时无法核验，请稍后重试。" },
        { status: 503, headers: { "Cache-Control": "private, no-store" } }
      );
    }
  }

  const result = await getContentUnitDownloadFilePath(slug);
  if (!result) return NextResponse.json({ error: "该资料暂未上传可下载文件。" }, { status: 404 });
  const buffer = await readFile(result.path);
  const fileName = result.file?.originalName || `${result.title}${path.extname(result.path)}`;

  let chargedPoints = 0;
  let pointsBalance = 0;
  let dailyRemaining: number | undefined;
  let dailyLimit: number | null | undefined;
  try {
    const claim = await claimMaterialPoints(session.user.id, [{ slug, cost: unit.meta.pointsCost }], expectedPoints);
    chargedPoints = claim.chargedPoints;
    pointsBalance = claim.pointsBalance;
    dailyRemaining = claim.dailyRemaining;
    dailyLimit = claim.dailyLimit;
    if (!claim.ok) {
      const response = NextResponse.json(
        {
          error: materialClaimError(claim),
          code: claim.code,
          dailyUsed: claim.dailyUsed, dailyRemaining: claim.dailyRemaining, dailyLimit: claim.dailyLimit, requestedNew: claim.requestedNew,
          requiredPoints: claim.requiredPoints,
          pointsBalance: claim.pointsBalance,
          shortfallPoints: Math.max(0, (claim.requiredPoints || 0) - claim.pointsBalance),
        },
        { status: claim.code === "POINTS_QUOTE_CHANGED" ? 409 : 403, headers: { "Cache-Control": "private, no-store" } }
      );
      if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
      return response;
    }
  } catch (error) {
    console.error("Failed to claim material points", error);
    return NextResponse.json(
      { error: "积分暂时无法核验，请稍后重试。", code: "POINTS_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  updateContentUnitCounter(slug, "downloadCount", 1).catch((error) => {
    console.error("Failed to update download count", error);
  });

  const response = new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType(fileName),
      "Content-Length": String(buffer.byteLength),
      "X-Material-Points-Charged": String(chargedPoints),
      "X-Material-Points-Balance": String(pointsBalance),
      ...(dailyLimit ? { "X-Material-Daily-Remaining": String(dailyRemaining ?? 0) } : {}),
      "Content-Disposition": downloadFileName(fileName),
      "Cache-Control": "private, no-store"
    }
  });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
