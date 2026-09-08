import { NextResponse } from "next/server";
import { requireAdmin, withAuthCookies } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);
const MAX_BYTES = 6 * 1024 * 1024;

function safeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "base";
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const baseId = safeSegment(String(form.get("baseId") || "new"));
    if (!(file instanceof File)) return NextResponse.json({ error: "请选择图片文件。" }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "仅支持 PNG、WebP 或 JPEG。" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "图片不能超过 6MB。" }, { status: 400 });

    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `${baseId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const admin = getSupabaseAdmin();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await admin.storage.from("education-base-images").upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false
    });
    if (error) throw error;

    const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
    const imageUrl = `/api/education-base-images/${encodedPath}`;
    return withAuthCookies(check.session, NextResponse.json({ imageUrl, storagePath }, { status: 201 }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    const readable = message.includes("Bucket not found")
      ? "基地图片存储尚未建立，请先执行 supabase/018_education_base_images.sql。"
      : message;
    return withAuthCookies(check.session, NextResponse.json({ error: readable }, { status: 500 }));
  }
}
