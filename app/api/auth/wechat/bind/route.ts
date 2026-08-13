import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { wechatOauthConfigured, wechatOauthUrl } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "wx_bind_state";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

/**
 * 绑定微信入口：/api/auth/wechat/bind
 * 要求当前已通过邮箱验证码登录；跳转微信 snsapi_base 静默授权，
 * 由 /api/auth/wechat/bind/callback 把 openid 绑定到当前账号。
 */
export async function GET() {
  if (!wechatOauthConfigured()) {
    return NextResponse.redirect(
      `${siteUrl()}/user?wxbind=error&reason=${encodeURIComponent("微信绑定暂未开通。")}`,
      302
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(`${siteUrl()}/login?redirect=${encodeURIComponent("/user")}`, 302);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(wechatOauthUrl(state, "/api/auth/wechat/bind/callback"), 302);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/"
  });
  return response;
}
