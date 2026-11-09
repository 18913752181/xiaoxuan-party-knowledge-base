import crypto from "crypto";
import { NextResponse } from "next/server";
import { wechatOauthConfigured, wechatOauthUrl } from "@/lib/wechat-pay";
import { wechatLoginReturn } from "@/lib/wechat-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETURN_COOKIE = "wx_login_return";
const STATE_COOKIE = "wx_login_state";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

/** 登录以本次微信授权为准，支付留存的 openid Cookie 不作为登录凭据。 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const returnTo = wechatLoginReturn(searchParams.get("return"));
  const useName = searchParams.get("name") === "1";
  const useAvatar = searchParams.get("avatar") === "1";

  if (!wechatOauthConfigured()) {
    return NextResponse.redirect(
      `${siteUrl()}/login?redirect=${encodeURIComponent(returnTo)}&wxlogin=error&reason=${encodeURIComponent("微信登录暂未开通，请使用邮箱验证码登录。")}`,
      302
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const scope = useName || useAvatar ? "snsapi_userinfo" : "snsapi_base";
  const response = NextResponse.redirect(wechatOauthUrl(state, "/api/auth/wechat/callback", scope), 302);
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set(STATE_COOKIE, state, cookieOpts);
  response.cookies.set(RETURN_COOKIE, returnTo, cookieOpts);
  response.cookies.set("wx_login_profile", `${Number(useName)}${Number(useAvatar)}`, cookieOpts);
  return response;
}
