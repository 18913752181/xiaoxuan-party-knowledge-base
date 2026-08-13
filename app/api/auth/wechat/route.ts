import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/server-auth";
import { wechatOauthConfigured, wechatOauthUrl } from "@/lib/wechat-pay";
import { loginWithWechatOpenid } from "@/lib/wechat-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETURN_COOKIE = "wx_login_return";
const STATE_COOKIE = "wx_login_state";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

/** 仅允许站内相对路径，防止开放重定向 */
function safeReturn(value: string) {
  return /^\/[a-z0-9/_\-?=&%.]*$/i.test(value) ? value : "/user";
}

/**
 * 微信一键登录入口：/api/auth/wechat?return=/user
 * - 浏览器已有 wx_openid Cookie（例如之前支付授权过）→ 直接登录，零跳转；
 * - 否则跳转微信 snsapi_base 静默授权，由 /api/auth/wechat/callback 完成登录。
 */
export async function GET(request: Request) {
  const returnTo = safeReturn(new URL(request.url).searchParams.get("return") || "/user");

  if (!wechatOauthConfigured()) {
    return NextResponse.redirect(
      `${siteUrl()}/login?wxlogin=error&reason=${encodeURIComponent("微信登录暂未开通，请使用邮箱验证码登录。")}`,
      302
    );
  }

  const existingOpenid = cookies().get("wx_openid")?.value || "";
  if (existingOpenid) {
    try {
      const tokens = await loginWithWechatOpenid(existingOpenid);
      const response = NextResponse.redirect(`${siteUrl()}${returnTo}`, 302);
      applyAuthCookies(response, tokens);
      return response;
    } catch {
      // openid 可能已失效（服务号变更等），回退去走完整授权
    }
  }

  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(wechatOauthUrl(state, "/api/auth/wechat/callback"), 302);
  const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
  response.cookies.set(STATE_COOKIE, state, cookieOpts);
  response.cookies.set(RETURN_COOKIE, returnTo, cookieOpts);
  return response;
}
