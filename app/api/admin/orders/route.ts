import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getMembership } from "@/lib/membership";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { listContentUnits } from "@/lib/content-units";

export const dynamic = "force-dynamic";
const orderLimit = 500;

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  const profile = await getMembership(session.user.id, session.accessToken);
  if (!profile.is_admin) return NextResponse.json({ error: "无权查看订单。" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const [membership, materials] = await Promise.all([
    admin.from("membership_orders")
      .select("id,out_trade_no,email,description,amount_total,status,wechat_transaction_id,paid_at,member_expires_at,created_at")
      .order("created_at", { ascending: false }).limit(orderLimit),
    admin.from("material_purchase_orders")
      .select("out_trade_no,user_id,first_slug,second_slug,amount_total,status,transaction_id,paid_at,created_at")
      .order("created_at", { ascending: false }).limit(orderLimit)
  ]);
  if (membership.error || materials.error) {
    console.error("Admin order lookup failed", membership.error || materials.error);
    return NextResponse.json({ error: "订单读取失败，请稍后重试。" }, { status: 500 });
  }

  const materialRows = materials.data || [];
  const userIds = Array.from(new Set(materialRows.map((order) => order.user_id)));
  const userLookups = [];
  for (let i = 0; i < userIds.length; i += 100) {
    userLookups.push(admin.from("profiles").select("id,email").in("id", userIds.slice(i, i + 100)));
  }
  const [units, profileResults] = await Promise.all([
    materialRows.length ? listContentUnits().catch(() => []) : [],
    Promise.all(userLookups)
  ]);
  const titles = new Map(units.map((unit) => [unit.slug, unit.meta.title]));
  const emails = new Map(profileResults.flatMap(({ data }) => (data || []).map((user) => [user.id, user.email] as const)));
  const orders = [
    ...(membership.data || []).map((order) => ({ ...order, kind: "membership" })),
    ...materialRows.map((order) => ({
      id: order.out_trade_no,
      out_trade_no: order.out_trade_no,
      kind: order.amount_total === 490 ? "pair" : "single",
      email: emails.get(order.user_id) || null,
      user_id: order.user_id,
      first_material: titles.get(order.first_slug) || order.first_slug,
      second_material: order.second_slug ? titles.get(order.second_slug) || order.second_slug : null,
      amount_total: order.amount_total,
      status: order.status,
      wechat_transaction_id: order.transaction_id,
      paid_at: order.paid_at,
      created_at: order.created_at
    }))
  ].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, orderLimit);
  const response = NextResponse.json({ orders }, { headers: { "Cache-Control": "private, no-store" } });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
