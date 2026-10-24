import { NextResponse } from "next/server";

import { grantDueAnnualMembershipPoints } from "@/lib/membership-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = (process.env.MEMBERSHIP_POINTS_CRON_SECRET || process.env.REMINDER_CRON_SECRET)?.trim();
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await grantDueAnnualMembershipPoints();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[membership-points] daily grant failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "年度会员积分发放失败" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
