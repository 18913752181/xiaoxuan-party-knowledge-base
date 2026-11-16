import { readFile } from "fs/promises";
import path from "path";
import { access } from "fs/promises";
import { constants } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { annualMembershipRequired, getMaterialEntitlement } from "@/lib/material-access";
import { materialPurchaseAccess, redeemMaterialPurchase } from "@/lib/material-purchase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const browserLinkLifetime = 2 * 60 * 1000;

function browserLinkSignature(payload: string) {
  const key = process.env.MATERIAL_DOWNLOAD_TICKET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Material download signing key is missing");
  return createHmac("sha256", key).update("material-browser-download:v1:" + payload).digest("base64url");
}

function browserLinkUser(ticket: string, slug: string): string | null {
  if (ticket.length > 2048 || !/^[\w-]+\.[\w-]{43}$/.test(ticket)) return null;
  const [payload, signature] = ticket.split(".");
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(browserLinkSignature(payload)))) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return claims.slug === slug && claims.expiresAt > Date.now() ? claims.userId : null;
}

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
  const encoded = encodeDownloadName(headerName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const extension = path.extname(headerName);
  const fallback = /^\.[a-z0-9]{1,10}$/i.test(extension) ? "material" + extension : "material";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
  const query = new URL(request.url).searchParams;
  const ticket = query.get("ticket");
  return download(params.id, { ticket, attachment: ticket !== null || query.get("attachment") === "1" });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "请求格式无效。" }, { status: 415 });
  const body = await request.json().catch(() => null);
  if (body?.browserLink === true) return download(params.id, { browserLink: true });
  if (body?.redeem !== true) return NextResponse.json({ error: "请先确认使用下载机会。" }, { status: 400 });
  return download(params.id, { redeem: true, unlockOnly: body.unlockOnly === true });
}

async function download(id: string, { redeem = false, attachment = false, unlockOnly = false, browserLink = false, ticket = null }: {
  redeem?: boolean;
  attachment?: boolean;
  unlockOnly?: boolean;
  browserLink?: boolean;
  ticket?: string | null;
}) {
  const session = ticket === null ? await getServerSession() : null;
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  };
  if (ticket === null && !session) return finish(NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 }));

  try {
    const slug = id.replace(/^content-/, "");
    const userId = ticket === null ? session?.user.id : browserLinkUser(ticket, slug);
    if (!userId) return finish(NextResponse.json({ error: "下载链接无效或已过期，请回到微信重新生成。" }, { status: 403 }));
    const entitlement = await getMaterialEntitlement(userId);
    const purchase = entitlement.canDownload ? null : await materialPurchaseAccess(userId, slug);
    if (purchase && !purchase.owned && (!redeem || !purchase.remaining)) {
      return finish(NextResponse.json(annualMembershipRequired, { status: 403 }));
    }
    const file = await getContentUnitDownloadFilePath(slug);
    if (!file) return finish(NextResponse.json({ error: "没有找到可下载的资料。" }, { status: 404 }));
    if (browserLink) {
      await access(file.path, constants.R_OK);
      const payload = Buffer.from(JSON.stringify({ userId, slug, expiresAt: Date.now() + browserLinkLifetime })).toString("base64url");
      return finish(NextResponse.json({ ticket: payload + "." + browserLinkSignature(payload) }));
    }
    if (unlockOnly) await access(file.path, constants.R_OK);
    const buffer = unlockOnly ? null : await readFile(file.path);
    if (purchase && !purchase.owned && !(await redeemMaterialPurchase(userId, slug))) {
      return finish(NextResponse.json({ error: "下载机会已用完，请刷新页面。" }, { status: 409 }));
    }
    if (!buffer) return finish(NextResponse.json({ unlocked: true }));
    const name = file.file?.originalName || (file.title + path.extname(file.path));

    await updateContentUnitCounter(slug, "downloadCount", 1).catch((error) => {
      console.error("Failed to update download count", error);
    });
    return finish(new NextResponse(new Uint8Array(buffer), { headers: {
      "Content-Type": attachment ? "application/octet-stream" : contentType(name),
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": downloadFileName(name)
    } }));
  } catch (error) {
    console.error("Material download failed", error);
    return finish(NextResponse.json({ error: "文件下载或权限核验暂时失败，请稍后重试。" }, { status: 503 }));
  }
}
