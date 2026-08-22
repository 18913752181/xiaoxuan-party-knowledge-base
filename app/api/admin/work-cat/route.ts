import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hongKongDayStart() {
  const date = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `${date}T00:00:00+08:00`;
}

export async function GET(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  const admin = getSupabaseAdmin();
  const url = new URL(request.url);
  const openid = url.searchParams.get("openid")?.trim();

  if (openid) {
    const { data, error } = await admin
      .from("wechat_conversations")
      .select("id,openid,role,content,category,created_at")
      .eq("openid", openid)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return withAuthCookies(check.session, NextResponse.json({ conversations: data || [] }));
  }

  const today = hongKongDayStart();
  const [users, messages, pendingCount, pendingRows, reminderRows] = await Promise.all([
    admin.from("wechat_users").select("openid", { count: "exact", head: true }).gte("last_active_at", today),
    admin.from("wechat_conversations").select("id", { count: "exact", head: true }).gte("created_at", today),
    admin.from("pending_questions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("pending_questions").select("id,openid,question,context_summary,category,status,created_at,replied_at").order("created_at", { ascending: false }).limit(200),
    admin.from("wechat_reminders").select("id,openid,content,status,created_at").order("created_at", { ascending: false }).limit(100)
  ]);

  const error = users.error || messages.error || pendingCount.error || pendingRows.error || reminderRows.error;
  if (error) return NextResponse.json({ error: `读取工作小猫数据失败：${error.message}` }, { status: 500 });

  return withAuthCookies(check.session, NextResponse.json({
    stats: {
      todayUsers: users.count || 0,
      todayMessages: messages.count || 0,
      pendingQuestions: pendingCount.count || 0
    },
    pendingQuestions: pendingRows.data || [],
    reminders: reminderRows.data || []
  }));
}

export async function PATCH(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const kind = body.kind === "reminder" ? "reminder" : "question";
  if (!id) return NextResponse.json({ error: "缺少记录 ID。" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (kind === "reminder") {
    const status = body.status === "done" ? "done" : body.status === "closed" ? "closed" : "pending";
    const { data, error } = await admin.from("wechat_reminders").update({ status }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return withAuthCookies(check.session, NextResponse.json({ ok: true, item: data }));
  }

  const status = body.status === "replied" ? "replied" : body.status === "closed" ? "closed" : "pending";
  const patch = { status, replied_at: status === "replied" ? new Date().toISOString() : null };
  const { data, error } = await admin.from("pending_questions").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return withAuthCookies(check.session, NextResponse.json({ ok: true, item: data }));
}
