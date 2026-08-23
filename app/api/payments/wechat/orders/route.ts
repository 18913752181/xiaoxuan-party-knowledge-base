import crypto from "crypto";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createNativeOrder, membershipPlan, wechatPayConfigured } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录后购买会员。" }, { status: 401 });
  if (!wechatPayConfigured()) {
    return NextResponse.json({ error: "微信支付尚未完成商户配置，请联系管理员。" }, { status: 503 });
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
    const codeUrl = await createNativeOrder({ outTradeNo, description, amountTotal });
    const response = NextResponse.json({ outTradeNo, codeUrl, amountTotal, expiresIn: 7200 });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    await admin.from("membership_orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("out_trade_no", outTradeNo);
    return NextResponse.json({ error: error instanceof Error ? error.message : "微信支付下单失败。" }, { status: 502 });
  }
}
