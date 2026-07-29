import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { outTradeNo: string } }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "登录状态已失效。" }, { status: 401 });
  const { data, error } = await getSupabaseAdmin()
    .from("membership_orders")
    .select("out_trade_no,status,amount_total,paid_at,member_expires_at,created_at")
    .eq("out_trade_no", params.outTradeNo)
    .eq("user_id", session.user.id)
    .single();
  if (error || !data) return NextResponse.json({ error: "没有找到该订单。" }, { status: 404 });
  const response = NextResponse.json({ order: data });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
