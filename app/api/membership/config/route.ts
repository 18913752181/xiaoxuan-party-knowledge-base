import { NextResponse } from "next/server";
import { membershipPlans, wechatJsapiConfigured, wechatPayConfigured } from "@/lib/wechat-pay";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: wechatPayConfigured(),
    jsapiConfigured: wechatJsapiConfigured(),
    plans: membershipPlans()
  });
}
