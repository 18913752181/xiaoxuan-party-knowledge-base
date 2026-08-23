import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createJsapiOrder,
  membershipPlan,
  signJsapiPayParams,
  wechatJsapiConfigured
} from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * JSAPI（公众号）支付下单：微信内置浏览器一键唤起收银台。
 * 依赖 wx_openid Cookie（由 /api/payments/wechat/oauth 授权流程写入）。
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录后购买会员。" }, { status: 401 });
  if (!wechatJsapiConfigured()) {
    return NextResponse.json({ error: "微信内支付尚未完成商户配置。" }, { status: 503 });
  }

  const openid = cookies().get("wx_openid")?.value || "";
  if (!openid) {
    // 前端收到 needOAuth 后跳转 /api/payments/wechat/oauth 完成静默授权
    return NextResponse.json({ needOAuth: true, error: "需要先完成微信授权。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const plan = membershipPlan(body?.planCode);
  if (!plan) return NextResponse.json({ error: "请选择月卡、季卡或年卡。" }, { status: 400 });
  const amountTotal = plan.amountTotal;
  const outTradeNo = `XX${Date.now()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`.slice(0, 32);
  const admin = getSupabaseAdmin();
  const description = plan.description;
  const { error: insertError } = await admin.from("membership_orders").insert({
    out_trade_no: outTradeNo,
    user_id: session.user.id,
    email: session.user.email || null,
    plan_code: plan.code,
    description,
    amount_total: amountTotal
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    const prepayId = await createJsapiOrder({ outTradeNo, description, amountTotal, openid });
    const response = NextResponse.json({
      outTradeNo,
      amountTotal,
      expiresIn: 7200,
      payParams: signJsapiPayParams(prepayId)
    });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    await admin.from("membership_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("out_trade_no", outTradeNo);
    return NextResponse.json({ error: error instanceof Error ? error.message : "微信支付下单失败。" }, { status: 502 });
  }
}
