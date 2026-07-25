import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ profile: null }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.accessToken}` } }
  });
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile =
    data ||
    ({
      id: session.user.id,
      email: session.user.email || "",
      nickname: session.user.email?.split("@")[0] || "小宣用户",
      member_status: "free",
      member_expires_at: null,
      is_admin: false
    } as const);

  const response = NextResponse.json({ profile, error: error?.message || "" });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

