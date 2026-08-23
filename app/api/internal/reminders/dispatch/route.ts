import { NextResponse } from "next/server";

import { dispatchDueMemberReminders } from "@/lib/work-cat/reminder-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.REMINDER_CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await dispatchDueMemberReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[member-reminders] dispatch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "提醒发送失败" }, { status: 500 });
  }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
