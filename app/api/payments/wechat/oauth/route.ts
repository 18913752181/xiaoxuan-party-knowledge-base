import crypto from "crypto";
import { NextResponse } from "next/server";
import { wechatJsapiConfigured, wechatOauthUrl } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 发起微信服务号网页授权（snsapi_base 静默授权），用于获取支付所需的 openid。
 * 支付页在微信内点击"微信支付"时跳转到这里，再由微信携 code 回到 callback。
 */
export async function GET() {
  if (!wechatJsapiConfigured()) {
    return NextResponse.json({ error: "微信内支付尚未完成配置。" }, { status: 503 });
  }
  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(wechatOauthUrl(state), 302);
  response.cookies.set("wx_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
