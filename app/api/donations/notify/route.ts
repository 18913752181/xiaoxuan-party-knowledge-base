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

/** 赞赏支付回调（与会员回调相互独立）。 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  let verified = false;
  try {
    verified = await verifyWechatNotification(request.headers, rawBody);
  } catch (error) {
    console.error("WeChat donation notification verification failed", error);
    return failure("回调验签暂时不可用。", 503);
  }
  if (!verified) {
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
    const { data: donation } = await admin
      .from("donations")
      .select("amount_cents,status")
      .eq("out_trade_no", transaction.out_trade_no)
      .single();
    if (!donation) return failure("赞赏记录不存在。");
    if (transaction.amount?.total !== donation.amount_cents) {
      return failure("支付金额不一致。");
    }

    if (donation.status !== "paid") {
      const { error } = await admin
        .from("donations")
        .update({ status: "paid" })
        .eq("out_trade_no", transaction.out_trade_no)
        .eq("status", "pending");
      if (error) throw error;
    }
    return NextResponse.json({ code: "SUCCESS", message: "成功" });
  } catch (error) {
    console.error("WeChat donation notification failed", error);
    return failure("处理支付通知失败。", 500);
  }
}
