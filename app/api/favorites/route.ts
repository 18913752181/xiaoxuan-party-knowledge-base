import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function client(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function sessionResponse(session: Awaited<ReturnType<typeof getServerSession>>, body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ rows: [], error: "登录后可收藏" }, { status: 401 });

  const { data, error } = await client(session.accessToken)
    .from("favorites")
    .select("id,user_id,article_slug,title,category,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) return sessionResponse(session, { rows: [], error: error.message }, 500);
  return sessionResponse(session, { rows: data || [], error: "" });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "登录后可收藏" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const articleSlug = String(body.articleSlug || "");
  const title = String(body.title || "");
  const category = String(body.category || "");
  if (!articleSlug || !title) {
    return sessionResponse(session, { error: "资料信息不完整。" }, 400);
  }

  const supabase = client(session.accessToken);
  const { data: existing, error: findError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("article_slug", articleSlug)
    .maybeSingle();

  if (findError) return sessionResponse(session, { error: findError.message }, 500);

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", session.user.id)
      .eq("article_slug", articleSlug);
    if (error) return sessionResponse(session, { error: error.message }, 500);
    return sessionResponse(session, { ok: true, favorited: false });
  }

  const { error } = await supabase.from("favorites").insert({
    user_id: session.user.id,
    article_slug: articleSlug,
    title,
    category
  });
  if (error) return sessionResponse(session, { error: error.message }, 500);
  return sessionResponse(session, { ok: true, favorited: true });
}

