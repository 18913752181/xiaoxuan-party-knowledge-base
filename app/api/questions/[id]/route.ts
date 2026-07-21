import { NextResponse } from "next/server";
import { addVisitorAnswer, listQuestions } from "@/lib/questions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const row = (await listQuestions()).find((item) => item.id === params.id && item.isPublic);
  if (!row) return NextResponse.json({ error: "没有找到这个问题。" }, { status: 404 });
  return NextResponse.json(row);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) return NextResponse.json({ error: "请输入回答。" }, { status: 400 });
  if (content.length > 1000) return NextResponse.json({ error: "回答不能超过1000字。" }, { status: 400 });
  const result = await addVisitorAnswer(params.id, content);
  if (!result) return NextResponse.json({ error: "问题不存在或暂未公开。" }, { status: 404 });
  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
