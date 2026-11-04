import { getMaterialPointState } from "@/lib/material-point-state";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ profile: null }, { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } }
  });
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  // A failed refresh must not replace an existing balance with a fake zero.
  if (error) {
    const response = NextResponse.json({ error: "账户信息暂时无法读取，请稍后重试。" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  }

  const profile =
    data ||
    ({
      id: session.user.id,
      email: session.user.email || "",
      nickname: session.user.email?.split("@")[0] || "小宣用户",
      avatar_key: null,
      member_status: "free",
      member_expires_at: null,
      points_balance: 0,
      is_admin: false,
      wechat_openid: null
    } as const);

  if (data) {
    try {
      const points = await getMaterialPointState(session.user.id);
      Object.assign(profile, { points_balance: points.pointsBalance, permanent_points_balance: points.permanentPoints ?? points.pointsBalance, daily_points_balance: points.dailyPoints ?? 0 });
    } catch {
      const failed = NextResponse.json({ error: "积分暂时无法读取。" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
      if (session.refreshedTokens) applyAuthCookies(failed, session.refreshedTokens);
      return failed;
    }
  }
  // openid 属于敏感标识，只向前端暴露“是否已绑定微信”
  const { wechat_openid, ...publicProfile } = profile as Record<string, unknown>;
  const response = NextResponse.json({
    profile: { ...publicProfile, wechat_bound: Boolean(wechat_openid) },
    error: ""
  }, { headers: { "Cache-Control": "private, no-store" } });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
