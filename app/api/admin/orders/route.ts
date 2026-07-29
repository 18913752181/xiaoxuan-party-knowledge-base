import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const profile = await getMembership(session.user.id);
  if (!profile.is_admin) return NextResponse.json({ error: "无权查看订单。" }, { status: 403 });
  const { data, error } = await getSupabaseAdmin()
    .from("membership_orders")
    .select("id,out_trade_no,email,description,amount_total,status,wechat_transaction_id,paid_at,member_expires_at,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const response = NextResponse.json({ orders: data || [] });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
