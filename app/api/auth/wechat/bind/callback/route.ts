import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchWechatOpenid } from "@/lib/wechat-pay";
import { findWechatBinding } from "@/lib/wechat-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

/**
 * 绑定微信授权回调：
 * code 换 openid → 校验当前登录账号 → openid 写入当前账号的 profiles.wechat_openid。
 *
 * 特殊情况：该 openid 之前微信一键登录自动建过伪邮箱账号，
 * 绑定会把 openid 从伪账号迁移过来；伪账号若仍是有效付费会员，
 * 会员权益一并合并到当前邮箱账号（取更晚的到期日）。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cookieStore = cookies();

  const fail = (reason: string) => {
    const response = NextResponse.redirect(
      `${siteUrl()}/user?wxbind=error&reason=${encodeURIComponent(reason)}`,
      302
    );
    response.cookies.delete("wx_bind_state");
    return response;
  };

  const session = await getServerSession();
  if (!session) {
    return NextResponse.redirect(`${siteUrl()}/login?redirect=${encodeURIComponent("/user")}`, 302);
  }

  const code = searchParams.get("code") || "";
  const state = searchParams.get("state") || "";
  const expectedState = cookieStore.get("wx_bind_state")?.value || "";
  if (!code || !state || !expectedState || state !== expectedState) {
    return fail("微信绑定状态校验失败，请重试。");
  }

  let openid = "";
  try {
    openid = await fetchWechatOpenid(code);
  } catch {
    return fail("微信授权失败，请重试。");
  }

  const admin = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // 该微信是否已绑定过账号
  const binding = await findWechatBinding(openid);
  if (binding && binding.userId !== session.user.id) {
    if (!binding.isPseudoAccount) {
      return fail("该微信已绑定其他邮箱账号，请先在该账号中解绑。");
    }

    // 伪邮箱账号：迁移绑定；其有效会员权益合并到当前账号
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("member_status,member_expires_at")
      .eq("id", session.user.id)
      .maybeSingle();

    const pseudoActive =
      binding.memberStatus === "member" && Boolean(binding.memberExpiresAt && binding.memberExpiresAt >= today);
    const currentExpiry = (currentProfile?.member_expires_at as string) || null;
    const currentActive =
      currentProfile?.member_status === "member" && Boolean(currentExpiry && currentExpiry >= today);

    const updates: Record<string, unknown> = { wechat_openid: openid };
    if (pseudoActive) {
      const mergedExpiry =
        currentActive && currentExpiry! > binding.memberExpiresAt! ? currentExpiry : binding.memberExpiresAt;
      updates.member_status = "member";
      updates.member_expires_at = mergedExpiry;
    }

    const { error: releaseError } = await admin
      .from("profiles")
      .update({ wechat_openid: null })
      .eq("id", binding.userId);
    if (releaseError) return fail("绑定失败，请稍后重试。");

    const { error: bindError } = await admin.from("profiles").update(updates).eq("id", session.user.id);
    if (bindError) return fail("绑定失败，请稍后重试。");

    const response = NextResponse.redirect(`${siteUrl()}/user?wxbind=ok`, 302);
    response.cookies.set("wx_openid", openid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/"
    });
    response.cookies.delete("wx_bind_state");
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  }

  // 正常绑定（含重复绑定同一账号，幂等）
  const { error: bindError } = await admin
    .from("profiles")
    .update({ wechat_openid: openid })
    .eq("id", session.user.id);
  if (bindError) return fail("绑定失败，请稍后重试。");

  const response = NextResponse.redirect(`${siteUrl()}/user?wxbind=ok`, 302);
  // 顺带记录 openid，之后微信内支付/登录无需再次授权
  response.cookies.set("wx_openid", openid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/"
  });
  response.cookies.delete("wx_bind_state");
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
