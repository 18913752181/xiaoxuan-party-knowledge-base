import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getContentUnitBySlug, getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";

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

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 });
  }

  const slug = decodeURIComponent(params.id).replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);
  if (!unit) return NextResponse.json({ error: "没有找到资料。" }, { status: 404 });
  if (unit.meta.isVip) {
    const membership = await getMembership(session.user.id, session.accessToken);
    if (!membership.active) {
      const response = NextResponse.json(
        { error: "该资料为会员专属，请先开通会员。", code: "MEMBERSHIP_REQUIRED" },
        { status: 403 }
      );
      if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
      return response;
    }
  }

  const result = await getContentUnitDownloadFilePath(slug);
  if (!result) return NextResponse.json({ error: "该资料暂未上传可下载文件。" }, { status: 404 });

  const buffer = await readFile(result.path);
  const fileName = result.file?.originalName || `${result.title}${path.extname(result.path)}`;

  updateContentUnitCounter(slug, "downloadCount", 1).catch((error) => {
    console.error("Failed to update download count", error);
  });

  const response = new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType(fileName),
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": downloadFileName(fileName),
      "Cache-Control": "private, no-store"
    }
  });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
