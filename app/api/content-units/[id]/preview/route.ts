import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getContentUnitBySlug, getContentUnitDownloadFilePath } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { authorizeMaterialAccess, materialAccessMessage } from "@/lib/material-access";
import { createMaterialPreviewPdf } from "@/lib/material-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  const error = (message: string, status: number, code?: string) => finish(NextResponse.json({ error: message, code }, { status }));
  if (!session) return error("请先登录后预览资料。", 401);
  const slug = params.id.replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);
  if (!unit) return error("没有找到资料。", 404);
  try {
    const file = await getContentUnitDownloadFilePath(slug);
    if (!file) return error("该资料暂未上传文件。", 404);
    const extension = path.extname(file.path).toLowerCase();
    if (![".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"].includes(extension)) {
      return error("此文件格式暂不支持在线预览，请下载原文件查看。", 415);
    }
    if ((await stat(file.path)).size > 50 * 1024 * 1024) return error("文件超过 50 MB，请下载原文件查看。", 413);
    const buffer = extension === ".pdf" ? await readFile(file.path) : await createMaterialPreviewPdf(file.path, extension);
    let access;
    try {
      access = await authorizeMaterialAccess(session.accessToken, unit.meta.slug, false, session.user.id);
    } catch {
      return error("资料权限暂时无法核验，请稍后重试。", 503);
    }
    if (!access.allowed) return error(materialAccessMessage(access), 403, access.code);
    return finish(new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Content-Length": String(buffer.length)
    } }));
  } catch {
    return error("暂时无法生成预览，请重试或下载原文件查看。", 422);
  }
}
