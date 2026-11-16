import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { annualMembershipRequired, getMaterialEntitlement } from "@/lib/material-access";
import { materialPurchaseAccess, redeemMaterialPurchase } from "@/lib/material-purchase";

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
  return download(params.id, false);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "请求格式无效。" }, { status: 415 });
  const body = await request.json().catch(() => null);
  if (body?.redeem !== true) return NextResponse.json({ error: "请先确认使用下载机会。" }, { status: 400 });
  return download(params.id, true);
}

async function download(id: string, redeem: boolean) {
  const session = await getServerSession();
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  if (!session) return finish(NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 }));

  try {
    const entitlement = await getMaterialEntitlement(session.user.id);
    const slug = id.replace(/^content-/, "");
    const purchase = entitlement.canDownload ? null : await materialPurchaseAccess(session.user.id, slug);
    if (purchase && !purchase.owned && (!redeem || !purchase.remaining)) {
      return finish(NextResponse.json(annualMembershipRequired, { status: 403 }));
    }
    const file = await getContentUnitDownloadFilePath(slug);
    if (!file) return finish(NextResponse.json({ error: "没有找到可下载的资料。" }, { status: 404 }));
    const buffer = await readFile(file.path);
    if (purchase && !purchase.owned && !(await redeemMaterialPurchase(session.user.id, slug))) {
      return finish(NextResponse.json({ error: "下载机会已用完，请刷新页面。" }, { status: 409 }));
    }
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
