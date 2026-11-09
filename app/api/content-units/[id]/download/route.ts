import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { annualMembershipRequired, getMaterialEntitlement } from "@/lib/material-access";

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
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  if (!session) return finish(NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 }));

  try {
    const entitlement = await getMaterialEntitlement(session.user.id);
    if (!entitlement.canDownload) return finish(NextResponse.json(annualMembershipRequired, { status: 403 }));

    const slug = params.id.replace(/^content-/, "");
    const file = await getContentUnitDownloadFilePath(slug);
    if (!file) return finish(NextResponse.json({ error: "没有找到可下载的资料。" }, { status: 404 }));
    const buffer = await readFile(file.path);
    const name = file.file?.originalName || (file.title + path.extname(file.path));

    await updateContentUnitCounter(slug, "downloadCount", 1).catch((error) => {
      console.error("Failed to update download count", error);
    });
    return finish(new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": contentType(name),
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": downloadFileName(name)
    } }));
  } catch (error) {
    console.error("Material download failed", error);
    return finish(NextResponse.json({ error: "文件下载或权限核验暂时失败，请稍后重试。" }, { status: 503 }));
  }
}
