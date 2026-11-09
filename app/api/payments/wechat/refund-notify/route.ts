import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  decryptWechatResource,
  verifyWechatNotification,
  wechatMerchantIdentity
} from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RefundNotification = {
  mchid?: string;
  out_trade_no?: string;
  refund_status?: string;
  amount?: { refund?: number; total?: number };
};

function failure(message: string, status = 400) {
  return NextResponse.json({ code: "FAIL", message }, { status });
}

function success() {
  return NextResponse.json({ code: "SUCCESS", message: "成功" });
}

function isRefundNotification(value: unknown): value is RefundNotification {
  return Boolean(value && typeof value === "object");
}

/**
 * 微信支付退款结果通知。
 *
 * 仅在整单退款成功时取消该笔订单带来的会员权益；部分退款只确认回调，
 * 不擅自改变会员状态。若用户在此后又成功续费，则保留后续会员权益。
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!(await verifyWechatNotification(request.headers, rawBody))) {
      return failure("签名验证失败。", 401);
    }
  } catch (error) {
    console.error("WeChat refund notification verification failed", error);
    return failure("回调验签暂时不可用。", 503);
  }

  try {
    const body = JSON.parse(rawBody);
    const refund = decryptWechatResource(body.resource);
    if (!isRefundNotification(refund)) return failure("退款通知格式无效。");

    const { mchid } = wechatMerchantIdentity();
    if (
      refund.refund_status !== "SUCCESS" ||
      !refund.out_trade_no ||
      refund.mchid !== mchid
    ) {
      return failure("退款结果无效。");
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("membership_orders")
      .select("status,amount_total")
      .eq("out_trade_no", refund.out_trade_no)
      .single();
    if (orderError || !order) return failure("订单不存在。");

    const refundAmount = refund.amount?.refund;
    const totalAmount = refund.amount?.total;
    const isFullRefund =
      Number.isInteger(refundAmount) &&
      Number.isInteger(totalAmount) &&
      refundAmount === totalAmount &&
      refundAmount === order.amount_total;

    // 微信会重试通知。已处理或部分退款都安全确认，避免重复撤销权益。
    if (order.status === "refunded" || !isFullRefund) return success();
    if (order.status !== "paid") return failure("订单尚未支付完成。");

    const { error: refundError } = await admin.rpc("refund_membership_order", {
      p_out_trade_no: refund.out_trade_no,
      p_amount_total: order.amount_total,
      p_raw_notification: body
    });
    if (refundError) throw refundError;

    return success();
  } catch (error) {
    console.error("WeChat refund notification failed", error);
    return failure("处理退款通知失败。", 500);
  }
}
