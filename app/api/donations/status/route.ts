import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyAuthCookies, getServerSession } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { donationPaymentConfigured } from "@/lib/donation-payment";
import { queryNativeOrder } from "@/lib/wechat-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function client(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

/**
 * 赞赏状态查询。若记录仍为待支付，主动向微信查单自愈：
 * 即使支付回调不可用（平台公钥未配置），用户付完款也能即时看到结果。
 */
export async function GET(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const outTradeNo = new URL(request.url).searchParams.get("outTradeNo") || "";
  if (!/^DON[A-Za-z0-9]{10,40}$/.test(outTradeNo)) {
    return NextResponse.json({ error: "单号无效。" }, { status: 400 });
  }

  const supabase = client(session.accessToken);
  const { data, error } = await supabase
    .from("donations")
    .select("status,amount_cents")
    .eq("out_trade_no", outTradeNo)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "赞赏记录不存在。" }, { status: 404 });

  let status = String(data.status);
  if (status === "pending" && donationPaymentConfigured()) {
    try {
      const order = await queryNativeOrder(outTradeNo);
      if (order?.trade_state === "SUCCESS" && order.amount?.total === data.amount_cents) {
        await getSupabaseAdmin()
          .from("donations")
          .update({ status: "paid" })
          .eq("out_trade_no", outTradeNo)
          .eq("status", "pending");
        status = "paid";
      }
    } catch {
      // 查单失败不影响返回当前状态，下一次轮询再试。
    }
  }

  const response = NextResponse.json({ status });
  if (session.refreshedTokens) applyAuthCookies(response, session.refreshedTokens);
  return response;
}
