import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 微信支付二维码图片接口。
 * 微信内置浏览器只对真实 http(s) 图片地址提供"长按识别二维码"，
 * data URL / canvas 均无法长按识别，因此二维码必须由服务端以 PNG 形式输出。
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const codeUrl = searchParams.get("url") || "";

  // 只允许渲染微信支付的 code_url，避免接口被滥用为通用二维码生成器
  if (!codeUrl.startsWith("weixin://")) {
    return NextResponse.json({ error: "非法的支付链接。" }, { status: 400 });
  }
  if (codeUrl.length > 512) {
    return NextResponse.json({ error: "支付链接过长。" }, { status: 400 });
  }

  try {
    const png = await QRCode.toBuffer(codeUrl, {
      type: "png",
      width: 560,
      margin: 1,
      errorCorrectionLevel: "M"
    });
    const response = new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": "private, no-store"
      }
    });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch {
    return NextResponse.json({ error: "二维码生成失败。" }, { status: 500 });
  }
}
