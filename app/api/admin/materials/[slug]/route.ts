import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  contentUnitToMaterial,
  deleteContentUnit,
  fileTypeFromName,
  getContentUnitBySlug,
  updateContentUnit,
} from "@/lib/content-units";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function revalidatePublicMaterial(slug: string) {
  revalidatePath("/library");
  revalidatePath("/library/materials");
  revalidatePath(`/materials/${slug}`);
}

const splitList = (value: FormDataEntryValue | null) =>
  String(value || "")
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const unit = await getContentUnitBySlug(params.slug, { includeHidden: true });
  if (!unit) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  return withAuthCookies(check.session, NextResponse.json(contentUnitToMaterial(unit)));
}

export async function PUT(request: Request, { params }: { params: { slug: string } }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

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
    organizationLevels: splitList(formData.get("organizationLevels")),
    workSections: splitList(formData.get("workSections")),
    workItems: splitList(formData.get("workItems")),
    previous: splitList(formData.get("previous")),
    next: splitList(formData.get("next")),
    related: splitList(formData.get("related")),
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
  revalidatePublicMaterial(params.slug);
  return withAuthCookies(check.session, NextResponse.json({ ok: true, material: contentUnitToMaterial(unit) }));
}

export async function DELETE(_request: Request, { params }: { params: { slug: string } }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const deleted = await deleteContentUnit(params.slug);
  if (!deleted) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  revalidatePublicMaterial(params.slug);
  return withAuthCookies(check.session, NextResponse.json({ ok: true }));
}

/** 列表页内联编辑：局部修改阶段、上一步工作、下一步工作。 */
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求格式不正确。" }, { status: 400 });
  }

  const updates: { stage?: string; previous?: string[]; next?: string[] } = {};
  if (typeof body.stage === "string") updates.stage = body.stage.trim();
  if (Array.isArray(body.previous)) updates.previous = body.previous.map((v: unknown) => String(v || "").trim()).filter(Boolean);
  if (Array.isArray(body.next)) updates.next = body.next.map((v: unknown) => String(v || "").trim()).filter(Boolean);
  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "没有需要修改的内容。" }, { status: 400 });
  }

  const unit = await updateContentUnit(params.slug, updates);
  if (!unit) return NextResponse.json({ error: "未找到资料。" }, { status: 404 });
  revalidatePublicMaterial(params.slug);
  return withAuthCookies(check.session, NextResponse.json({ ok: true, material: contentUnitToMaterial(unit) }));
}
