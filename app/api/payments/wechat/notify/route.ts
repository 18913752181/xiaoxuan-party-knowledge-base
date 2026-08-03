import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  decryptWechatResource,
  verifyWechatNotification,
  wechatAcceptedAppIds,
  wechatMerchantIdentity
} from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(message: string, status = 400) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyWechatNotification(request.headers, rawBody))) {
    return failure("签名验证失败。", 401);
  }

  try {
    const body = JSON.parse(rawBody);
    const transaction = decryptWechatResource(body.resource);
    const identity = wechatMerchantIdentity();
    if (
      transaction.trade_state !== "SUCCESS" ||
      transaction.mchid !== identity.mchid ||
      !wechatAcceptedAppIds().includes(transaction.appid)
    ) return failure("支付结果无效。");

    const admin = getSupabaseAdmin();
    const { data: order } = await admin
      .from("membership_orders")
      .select("amount_total,status")
      .eq("out_trade_no", transaction.out_trade_no)
      .single();
    if (!order) return failure("订单不存在。");
    if (transaction.amount?.total !== order.amount_total) {
      return failure("支付金额不一致。");
    }

    if (order.status !== "paid") {
      const { error } = await admin.rpc("activate_membership_order", {
        p_out_trade_no: transaction.out_trade_no,
        p_transaction_id: transaction.transaction_id,
        p_paid_at: transaction.success_time,
        p_raw_notification: body
      });
      if (error) throw error;
    }
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    console.error("WeChat payment notification failed", error);
    return failure("处理支付通知失败。", 500);
  }
}
