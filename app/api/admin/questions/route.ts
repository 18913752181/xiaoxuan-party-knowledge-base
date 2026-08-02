import { NextResponse } from "next/server";
import { listQuestions, updateQuestion } from "@/lib/questions";
import { withAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdmin(async () => {
  return NextResponse.json(await listQuestions());
});

export const PATCH = withAdmin(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const answer = String(body.answer || "").trim();
  const status = body.status === "processed" ? "processed" : "pending";
  const row = await updateQuestion(id, { answer, isPublic: Boolean(body.isPublic) && Boolean(answer), status });
  if (!row) return NextResponse.json({ error: "没有找到该问题。" }, { status: 404 });
  return NextResponse.json({ ok: true, question: row });
});
