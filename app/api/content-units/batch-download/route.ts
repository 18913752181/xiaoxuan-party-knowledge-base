import { readFile, stat } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { getServerSession, applyAuthCookies } from "@/lib/server-auth";
import { authorizeMaterialAccess, materialAccessMessage } from "@/lib/material-access";
import { getContentUnitBySlug, getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession();
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  const error = (message: string, status: number, code?: string) => finish(NextResponse.json({ error: message, code }, { status }));
  if (!session) return error("请先登录后下载。", 401);
  try {
    const access = await authorizeMaterialAccess(session.accessToken, null, true, session.user.id);
    if (!access.allowed) return error(materialAccessMessage(access), 403, access.code);
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.slugs) || !body.slugs.length || body.slugs.length > 50 || body.slugs.some((slug: unknown) => typeof slug !== "string" || !slug || slug.length > 500)) {
      return error("请每次选择 1 至 50 份资料。", 400);
    }
    const slugs = Array.from(new Set<string>(body.slugs.map((slug: string) => slug.replace(/^content-/, ""))));
    const zip = new JSZip();
    const used = new Set<string>();
    let size = 0;
    for (const slug of slugs) {
      const unit = await getContentUnitBySlug(slug);
      const file = unit ? await getContentUnitDownloadFilePath(slug) : null;
      if (!file) return error("所选资料中有文件已移除或尚未上传，请刷新列表后重试。", 404);
      size += (await stat(file.path)).size;
      if (size > 100 * 1024 * 1024) return error("本次资料总大小超过 100 MB，请分批下载。", 413);
      const original = (file.file?.originalName || `${file.title}${path.extname(file.path)}`).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
      let name = original;
      let index = 2;
      const ext = path.extname(original);
      while (used.has(name)) name = `${original.slice(0, original.length - ext.length)} (${index++})${ext}`;
      used.add(name);
      zip.file(name, await readFile(file.path));
    }
    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 3 } });
    await Promise.all(slugs.map((slug) => updateContentUnitCounter(slug, "downloadCount", 1).catch(() => {})));
    return finish(new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=materials.zip"
    } }));
  } catch {
    return error("资料打包或权限核验暂时失败，请稍后重试。", 503);
  }
}
