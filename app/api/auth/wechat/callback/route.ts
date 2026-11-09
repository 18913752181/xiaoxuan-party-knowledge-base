import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies } from "@/lib/server-auth";
import { exchangeWechatOauthCode, fetchWechatOauthProfile } from "@/lib/wechat-pay";
import { loginWithWechatOpenid } from "@/lib/wechat-login";
import { wechatAvatarUrl, wechatLoginReturn, wechatNickname } from "@/lib/wechat-profile";

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
  const returnTo = wechatLoginReturn(cookieStore.get("wx_login_return")?.value);
  const choices = cookieStore.get("wx_login_profile")?.value || "";
  const useName = /^(10|11)$/.test(choices);
  const useAvatar = /^(01|11)$/.test(choices);

  const fail = (reason: string) =>
    NextResponse.redirect(
      `${siteUrl()}/login?redirect=${encodeURIComponent(returnTo)}&wxlogin=error&reason=${encodeURIComponent(reason)}`,
      302
    );

  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || "";
  const expectedState = cookieStore.get("wx_login_state")?.value || "";
  if (!state || !expectedState || state !== expectedState) {
    return fail("微信登录状态校验失败，请重试。");
  }
  if (!code || code === "authdeny") return fail("已取消微信授权。你可以取消勾选昵称和头像，再使用微信登录。");

  let identity: Awaited<ReturnType<typeof exchangeWechatOauthCode>>;
  try {
    identity = await exchangeWechatOauthCode(code);
  } catch {
    return fail("微信授权失败，请重试。");
  }

  let tokens;
  try {
    const loadProfile = useName || useAvatar ? async () => {
      const profile = await fetchWechatOauthProfile(identity).catch(() => null);
      return {
        nickname: useName ? wechatNickname(profile?.nickname) : null,
        avatarUrl: useAvatar ? wechatAvatarUrl(profile?.avatarUrl) : null
      };
    } : undefined;
    tokens = await loginWithWechatOpenid(identity.openid, loadProfile);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "微信登录失败，请稍后重试。");
  }

  const response = NextResponse.redirect(`${siteUrl()}${returnTo}`, 302);
  applyAuthCookies(response, tokens);
  // 顺带记录 openid，之后微信内支付无需再次授权
  response.cookies.set("wx_openid", identity.openid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/"
  });
  response.cookies.delete("wx_login_state");
  response.cookies.delete("wx_login_return");
  response.cookies.delete("wx_login_profile");
  return response;
}
