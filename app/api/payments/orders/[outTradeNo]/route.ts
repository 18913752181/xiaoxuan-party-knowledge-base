import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { queryNativeOrder, wechatPayConfigured } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_COLUMNS = "out_trade_no,status,amount_total,paid_at,member_expires_at,created_at";

/**
 * 查询订单支付状态。
 * 订单仍为 pending 时主动向微信查单自愈：微信支付公钥未配置导致回调
 * 验签不可用的期间，用户付完款也能被及时确认并开通会员。
 */
export async function GET(_request: Request, { params }: { params: { outTradeNo: string } }) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "登录状态已失效。" }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("membership_orders")
    .select(ORDER_COLUMNS)
    .eq("out_trade_no", params.outTradeNo)
    .eq("user_id", session.user.id)
    .single();
  if (error || !data) return NextResponse.json({ error: "没有找到该订单。" }, { status: 404 });

  let order = data;
  if (order.status === "pending" && wechatPayConfigured()) {
    try {
      const wx = await queryNativeOrder(order.out_trade_no);
      if (wx?.trade_state === "SUCCESS" && wx.amount?.total === order.amount_total) {
        const { error: activateError } = await admin.rpc("activate_membership_order", {
          p_out_trade_no: order.out_trade_no,
          p_transaction_id: wx.transaction_id,
          p_paid_at: wx.success_time,
          p_raw_notification: wx
        });
        if (!activateError) {
          const { data: fresh } = await admin
            .from("membership_orders")
            .select(ORDER_COLUMNS)
            .eq("out_trade_no", params.outTradeNo)
            .eq("user_id", session.user.id)
            .single();
          if (fresh) order = fresh;
        } else {
          console.error("activate_membership_order failed", activateError);
        }
      }
    } catch (queryError) {
      // 查单失败不影响返回当前状态，下一次轮询再试。
      console.error("queryNativeOrder failed", queryError);
    }
  }

  const response = NextResponse.json({ order });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
