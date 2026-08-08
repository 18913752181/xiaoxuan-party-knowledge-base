import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchWechatOpenid } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 微信网页授权回调：用 code 换 openid，写入 httpOnly Cookie 后回到支付页自动唤起收银台。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
  const returnTo = cookies().get("wx_oauth_return")?.value || "/membership/payment";
  const joiner = returnTo.includes("?") ? "&" : "?";
  const fail = (reason: string) =>
    NextResponse.redirect(`${siteUrl}${returnTo}${joiner}jsapi=error&reason=${encodeURIComponent(reason)}`, 302);

  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || "";
  const expectedState = cookies().get("wx_oauth_state")?.value || "";
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("授权状态校验失败，请重试。");
  }

  let openid = "";
  try {
    openid = await fetchWechatOpenid(code);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "微信授权失败。");
  }

  const response = NextResponse.redirect(`${siteUrl}${returnTo}${joiner}jsapi=auto`, 302);
  // openid 与站点账号无敏感绑定，仅作为支付付款人标识，保存 30 天避免重复授权
  response.cookies.set("wx_openid", openid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/"
  });
  response.cookies.delete("wx_oauth_state");
  response.cookies.delete("wx_oauth_return");
  return response;
}
