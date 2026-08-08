import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { donationPaymentConfigured, newDonationOutTradeNo } from "@/lib/donation-payment";
import { createJsapiOrder, signJsapiPayParams, wechatJsapiConfigured } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const MIN_CENTS = 100;
const MAX_CENTS = 200_000;

function client(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://xiaoxuanvip.com").replace(/\/+$/, "");
}

/**
 * 赞赏 JSAPI（公众号）支付下单：微信内置浏览器直接唤起收银台，
 * 无需长按二维码。依赖 wx_openid Cookie（授权流程写入）。
 */
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!donationPaymentConfigured() || !wechatJsapiConfigured()) {
    return NextResponse.json({ error: "微信内支付尚未完成配置。" }, { status: 503 });
  }

  const openid = cookies().get("wx_openid")?.value || "";
  if (!openid) {
    return NextResponse.json({ needOAuth: true, error: "需要先完成微信授权。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const amountCents = Math.round(Number(body.amountCents || 0));
  const sourceSlug = String(body.sourceSlug || "").slice(0, 200);
  const sourceTitle = String(body.sourceTitle || "").slice(0, 200);
  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json({ error: "赞赏金额需在 1-2000 元之间。" }, { status: 400 });
  }

  const outTradeNo = newDonationOutTradeNo();
  const supabase = client(session.accessToken);
  const { error: insertError } = await supabase.from("donations").insert({
    user_id: session.user.id,
    amount_cents: amountCents,
    source_slug: sourceSlug,
    source_title: sourceTitle,
    status: "pending",
    provider: "wechat-jsapi",
    out_trade_no: outTradeNo
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    const prepayId = await createJsapiOrder({
      outTradeNo,
      description: "支持小宣自愿赞赏",
      amountTotal: amountCents,
      openid,
      notifyUrl: `${siteUrl()}/api/donations/notify`
    });
    const response = NextResponse.json({
      outTradeNo,
      amountCents,
      payParams: signJsapiPayParams(prepayId)
    });
    if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    try {
      await getSupabaseAdmin()
        .from("donations")
        .update({ status: "cancelled" })
        .eq("out_trade_no", outTradeNo)
        .eq("status", "pending");
    } catch {
      // 忽略清理失败
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "微信支付下单失败。" }, { status: 502 });
  }
}
