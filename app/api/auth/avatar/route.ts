import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAvatarKey } from "@/components/ProfileAvatar";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function PATCH(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const avatarKey = typeof body.avatar_key === "string" ? body.avatar_key : "";
  if (!isAvatarKey(avatarKey)) {
    return NextResponse.json({ error: "头像选择无效。" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } }
  });
  const { error } = await supabase.from("profiles").update({ avatar_key: avatarKey }).eq("id", session.user.id);
  if (error) return NextResponse.json({ error: "头像保存失败，请稍后重试。" }, { status: 500 });

  const response = NextResponse.json({ ok: true, avatar_key: avatarKey });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
