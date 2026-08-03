import { NextResponse } from "next/server";
import { annualPriceCents, wechatJsapiConfigured, wechatPayConfigured } from "@/lib/wechat-pay";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: wechatPayConfigured(),
    jsapiConfigured: wechatJsapiConfigured(),
    plan: {
      code: "annual",
      name: "小宣资料库年度会员",
      duration: "1 年",
      amountTotal: annualPriceCents()
    }
  });
}
