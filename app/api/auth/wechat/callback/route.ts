import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/server-auth";
import { fetchWechatOpenid } from "@/lib/wechat-pay";
import { loginWithWechatOpenid } from "@/lib/wechat-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

/**
 * 微信登录授权回调：code 换 openid → 查找/创建账号 → 写 30 天会话 Cookie → 回跳目标页。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = cookies();
  const returnTo = cookieStore.get("wx_login_return")?.value || "/user";

  const fail = (reason: string) =>
    NextResponse.redirect(
      `${siteUrl()}/login?wxlogin=error&reason=${encodeURIComponent(reason)}`,
      302
    );

  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || "";
  const expectedState = cookieStore.get("wx_login_state")?.value || "";
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("微信登录状态校验失败，请重试。");
  }

  let openid = "";
  try {
    openid = await fetchWechatOpenid(code);
  } catch {
    return fail("微信授权失败，请重试。");
  }

  let tokens;
  try {
    tokens = await loginWithWechatOpenid(openid);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "微信登录失败，请稍后重试。");
  }

  const response = NextResponse.redirect(`${siteUrl()}${returnTo}`, 302);
  applyAuthCookies(response, tokens);
  // 顺带记录 openid，之后微信内支付无需再次授权
  response.cookies.set("wx_openid", openid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/"
  });
  response.cookies.delete("wx_login_state");
  response.cookies.delete("wx_login_return");
  return response;
}
