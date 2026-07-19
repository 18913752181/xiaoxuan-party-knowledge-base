import { NextResponse } from "next/server";
import { createContentUnit, fileTypeFromName } from "@/lib/content-units";
import { listTopics } from "@/lib/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedExtensions = [".doc", ".docx", ".xls", ".xlsx", ".pdf", ".ppt", ".pptx"];

const splitList = (value: FormDataEntryValue | null) =>
  String(value || "")
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = String(formData.get("title") || "").trim();
  const topic = String(formData.get("topic") || "").trim();
  const category = String(formData.get("category") || topic || "").trim();
  const file = formData.get("file");

  if (!title || !topic || !category) {
    return NextResponse.json({ error: "标题、专题和分类不能为空。" }, { status: 400 });
  }

  const allowedTopics = await listTopics();
  if (!allowedTopics.includes(topic) && !allowedTopics.includes(category)) {
    return NextResponse.json({ error: "专题不在允许范围内，请先在专题管理中新增该专题。" }, { status: 400 });
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请先上传资料文件。" }, { status: 400 });
  }

  const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  if (!allowedExtensions.includes(ext)) {
    return NextResponse.json({ error: "仅支持 Word、Excel、PDF、PPT 文件。" }, { status: 400 });
  }

  const unit = await createContentUnit({
    title,
    topic,
    category: topic || category,
    stage: String(formData.get("stage") || "").trim(),
    tags: splitList(formData.get("tags")),
    summary: String(formData.get("summary") || "").trim(),
    isVip: String(formData.get("isVip") || "") === "true",
    status: String(formData.get("status") || "published") as "draft" | "published" | "hidden",
    introduction: String(formData.get("introduction") || "").trim(),
    policyBasis: String(formData.get("policyBasis") || "").trim(),
    scenarios: String(formData.get("scenarios") || "").trim(),
    process: String(formData.get("process") || "").trim(),
    notices: String(formData.get("notices") || "").trim(),
    faq: String(formData.get("faq") || "").trim(),
    downloadNote: String(formData.get("downloadNote") || "").trim(),
    note: String(formData.get("note") || "").trim(),
    previous: splitList(formData.get("previous")),
    next: splitList(formData.get("next")),
    related: splitList(formData.get("related")),
    sameTopic: splitList(formData.get("related")),
    recommended: splitList(formData.get("recommended")),
    seoTitle: String(formData.get("seoTitle") || "").trim(),
    seoDescription: String(formData.get("seoDescription") || "").trim(),
    seoKeywords: splitList(formData.get("seoKeywords")),
    file: {
      name: file.name,
      buffer: await fileToBuffer(file),
      fileType: fileTypeFromName(file.name),
      fileSize: file.size
    }
  });

  return NextResponse.json({ ok: true, slug: unit.slug, path: unit.dir, meta: unit.meta });
}
