import { NextResponse } from "next/server";
import {
  contentUnitToMaterial,
  deleteContentUnit,
  fileTypeFromName,
  getContentUnitBySlug,
  updateContentUnit,
} from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const splitList = (value: FormDataEntryValue | null) =>
  String(value || "")
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const unit = await getContentUnitBySlug(params.slug, { includeHidden: true });
  if (!unit) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  return NextResponse.json(contentUnitToMaterial(unit));
}

export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const formData = await request.formData();
  const file = formData.get("file");
  const payload = {
    title: String(formData.get("title") || "").trim(),
    topic: String(formData.get("topic") || "").trim(),
    category: String(formData.get("category") || "").trim(),
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
  };

  const unit = await updateContentUnit(params.slug, {
    ...payload,
    file:
      file instanceof File && file.size > 0
        ? { name: file.name, buffer: await fileToBuffer(file), fileType: fileTypeFromName(file.name), fileSize: file.size }
        : undefined,
  });

  if (!unit) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  return NextResponse.json({ ok: true, material: contentUnitToMaterial(unit) });
}

export async function DELETE(_request: Request, { params }: { params: { slug: string } }) {
  const deleted = await deleteContentUnit(params.slug);
  if (!deleted) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
