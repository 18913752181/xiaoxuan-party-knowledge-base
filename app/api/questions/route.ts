import { NextResponse } from "next/server";
import { createQuestion, listQuestions } from "@/lib/questions";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listQuestions();
  return NextResponse.json(rows.filter((row) => row.isPublic && row.answer.trim()));
}

export async function POST(request: Request) {
  // 未登录也可提问，按 IP 限流防止恶意刷屏。
  if (!rateLimit(`question:${clientIp(request)}`, 5, 60 * 1000)) {
    return NextResponse.json({ error: "提交太频繁，请稍后再试。" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "请输入问题。" }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "问题不能超过500字。" }, { status: 400 });
  const row = await createQuestion(question);
  return NextResponse.json({ ok: true, question: row }, { status: 201 });
}
