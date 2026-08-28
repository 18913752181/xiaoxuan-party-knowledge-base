import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);
const MAX_BYTES = 6 * 1024 * 1024;

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "dimmo";
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const slug = safeSlug(String(form.get("slug") || "dimmo-expression"));
    if (!(file instanceof File)) return NextResponse.json({ error: "请选择图片文件。" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "仅支持 PNG、WebP 或 JPEG。" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "图片不能超过 6MB。" }, { status: 400 });

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `${slug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const admin = getSupabaseAdmin();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await admin.storage.from("dimmo-expressions").upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;
    const { data } = admin.storage.from("dimmo-expressions").getPublicUrl(storagePath);
    return withAuthCookies(check.session, NextResponse.json({ imageUrl: data.publicUrl, storagePath }, { status: 201 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    const readable = message.includes("Bucket not found") ? "图片存储桶尚未建立，请先执行 supabase/014_dimmo_expressions.sql。" : message;
    return withAuthCookies(check.session, NextResponse.json({ error: readable }, { status: 500 }));
  }
}
