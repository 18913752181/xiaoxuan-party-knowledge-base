import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isWechatAccount } from "@/lib/wechat-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 解绑微信：POST /api/auth/wechat/unbind
 * 清除当前账号 profiles.wechat_openid。
 * 纯微信账号（伪邮箱）没有第二种登录方式，不允许解绑，避免账号彻底丢失。
 */
export async function POST() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  if (isWechatAccount(session.user.email)) {
    return NextResponse.json(
      { error: "当前账号由微信一键登录创建，微信是唯一登录方式，不能解绑。" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({ wechat_openid: null })
    .eq("id", session.user.id);
  if (error) {
    return NextResponse.json({ error: "解绑失败，请稍后重试。" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  // wx_openid Cookie 只是当前浏览器的授权缓存，解绑后一并清除
  response.cookies.delete("wx_openid");
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
