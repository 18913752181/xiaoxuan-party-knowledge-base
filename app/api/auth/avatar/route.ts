import { NextResponse } from "next/server";
import { isAvatarKey } from "@/components/ProfileAvatar";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const avatarKey = typeof body.avatar_key === "string" ? body.avatar_key : "";
  if (!isAvatarKey(avatarKey)) {
    return NextResponse.json({ error: "头像选择无效。" }, { status: 400 });
  }

  // 先由 getServerSession 校验当前用户，再用仅服务端可用的管理客户端写入。
  // profiles 的 RLS 在部分旧环境只允许读取，会让用户 token 的 update 静默更新 0 行。
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("profiles")
    .update({ avatar_key: avatarKey })
    .eq("id", session.user.id)
    .select("avatar_key")
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "头像保存失败，请稍后重试。" }, { status: 500 });

  const response = NextResponse.json({ ok: true, avatar_key: avatarKey });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
