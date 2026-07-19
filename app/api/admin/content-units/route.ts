import { NextResponse } from "next/server";
import { createContentUnit } from "@/lib/content-units";
import { listTopics } from "@/lib/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json();
  const title = String(payload.title || "").trim();
  const topic = String(payload.topic || payload.category || "").trim();
  const category = String(payload.category || topic || "").trim();
  const content = String(payload.content || payload.body || "").trim();
  const isVip = Boolean(payload.isVip ?? payload.isMemberOnly);

  if (!title || !topic || !category || !content) {
    return NextResponse.json({ error: "标题、专题、分类和正文不能为空。" }, { status: 400 });
  }

  const allowedTopics = await listTopics();
  if (!allowedTopics.includes(topic) && !allowedTopics.includes(category)) {
    return NextResponse.json({ error: "专题不在允许范围内，请先在专题管理中新增该专题。" }, { status: 400 });
  }

  const unit = await createContentUnit({
    title,
    category: topic || category,
    topic,
    summary: content.slice(0, 160),
    introduction: content,
    isVip,
    status: "published"
  });

  return NextResponse.json({ ok: true, meta: unit.meta, slug: unit.meta.slug, path: unit.dir });
}
