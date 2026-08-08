import crypto from "crypto";
import { NextResponse } from "next/server";
import { wechatJsapiConfigured, wechatOauthUrl } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 发起微信服务号网页授权（snsapi_base 静默授权），用于获取支付所需的 openid。
 * 支付页在微信内点击"微信支付"时跳转到这里，再由微信携 code 回到 callback。
 * 支持 ?return=/support 指定授权完成后的回跳页面（仅限站内路径）。
 */
export async function GET(request: Request) {
  if (!wechatJsapiConfigured()) {
    return NextResponse.json({ error: "微信内支付尚未完成配置。" }, { status: 503 });
  }
  const returnTo = new URL(request.url).searchParams.get("return") || "";
  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(wechatOauthUrl(state), 302);
  response.cookies.set("wx_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  if (/^\/[a-z0-9/_\-?=&%.]*$/i.test(returnTo)) {
    response.cookies.set("wx_oauth_return", returnTo, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/"
    });
  }
  return response;
}
