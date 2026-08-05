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

function tableMissing(errorMessage: string) {
  return errorMessage.toLowerCase().includes("downloads");
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ rows: [], error: "登录后可见下载记录" }, { status: 401 });

  const { data, error } = await client(session.accessToken)
    .from("downloads")
    .select("id,user_id,article_slug,title,category,file_type,created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Table not created yet: behave as "no records" so the UI keeps working.
    if (tableMissing(error.message)) return sessionResponse(session, { rows: [], error: "" });
    return sessionResponse(session, { rows: [], error: error.message }, 500);
  }
  return sessionResponse(session, { rows: data || [], error: "" });
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "登录后记录下载" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const articleSlug = String(body.articleSlug || "");
  const title = String(body.title || "");
  const category = String(body.category || "");
  const fileType = String(body.fileType || "");
  if (!articleSlug || !title) {
    return sessionResponse(session, { error: "资料信息不完整。" }, 400);
  }

  const supabase = client(session.accessToken);

  // Re-downloading moves the record to the top: rewrite the row.
  await supabase
    .from("downloads")
    .delete()
    .eq("user_id", session.user.id)
    .eq("article_slug", articleSlug);

  const { error } = await supabase.from("downloads").insert({
    user_id: session.user.id,
    article_slug: articleSlug,
    title,
    category,
    file_type: fileType
  });
  if (error) {
    if (tableMissing(error.message)) return sessionResponse(session, { ok: true });
    return sessionResponse(session, { error: error.message }, 500);
  }
  return sessionResponse(session, { ok: true });
}
