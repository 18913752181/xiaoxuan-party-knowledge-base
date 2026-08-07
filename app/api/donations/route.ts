import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createDonationPayment,
  donationPaymentConfigured,
  newDonationOutTradeNo
} from "@/lib/donation-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const MIN_CENTS = 100; // 1 元
const MAX_CENTS = 200_000; // 2000 元，防止误输入

function client(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

function sessionResponse(session: Awaited<ReturnType<typeof getServerSession>>, body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  if (session?.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}

function tableMissing(errorMessage: string) {
  return errorMessage.toLowerCase().includes("donations");
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const amountCents = Math.round(Number(body.amountCents || 0));
  const sourceSlug = String(body.sourceSlug || "").slice(0, 200);
  const sourceTitle = String(body.sourceTitle || "").slice(0, 200);

  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return sessionResponse(session, { error: "赞赏金额需在 1-2000 元之间。" }, 400);
  }

  // 支付通道未配置：不创建记录、不扣款，只向前台报告状态。
  if (!donationPaymentConfigured()) {
    return sessionResponse(session, { ok: false, configured: false, error: "支付通道正在配置中，本次未产生任何费用。" });
  }

  const outTradeNo = newDonationOutTradeNo();
  const supabase = client(session.accessToken);
  const { error } = await supabase.from("donations").insert({
    user_id: session.user.id,
    amount_cents: amountCents,
    source_slug: sourceSlug,
    source_title: sourceTitle,
    status: "pending",
    provider: "wechat",
    out_trade_no: outTradeNo
  });

  if (error) {
    if (tableMissing(error.message)) {
      return sessionResponse(session, { ok: false, configured: false, error: "赞赏功能暂未开放。" });
    }
    return sessionResponse(session, { error: error.message }, 500);
  }

  try {
    const payment = await createDonationPayment({ outTradeNo, amountCents });
    if (!payment.configured) {
      return sessionResponse(session, { ok: false, configured: false, error: "支付通道正在配置中，本次未产生任何费用。" });
    }
    return sessionResponse(session, {
      ok: true,
      configured: true,
      outTradeNo: payment.outTradeNo,
      codeUrl: payment.codeUrl,
      amountCents
    });
  } catch (err) {
    // 微信下单失败：作废刚创建的记录，避免统计页出现无效待支付单。
    try {
      await getSupabaseAdmin()
        .from("donations")
        .update({ status: "cancelled" })
        .eq("out_trade_no", outTradeNo)
        .eq("status", "pending");
    } catch {
      // 忽略清理失败
    }
    return sessionResponse(
      session,
      { error: err instanceof Error ? err.message : "微信支付下单失败，请稍后再试。" },
      502
    );
  }
}
