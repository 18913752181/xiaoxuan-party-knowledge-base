import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

export async function GET(_request: Request, context: { params: { path: string[] } }) {
  const parts = context.params.path || [];
  if (!parts.length || parts.some((part) => !part || part === "." || part === "..")) {
    return NextResponse.json({ error: "无效的图片路径。" }, { status: 400 });
  }
  try {
    const storagePath = parts.join("/");
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage.from("education-base-images").download(storagePath);
    if (error || !data) return NextResponse.json({ error: "图片不存在。" }, { status: 404 });
    const extension = storagePath.split(".").pop()?.toLowerCase() || "jpg";
    return new NextResponse(await data.arrayBuffer(), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] || data.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "图片暂时无法读取。" }, { status: 500 });
  }
}
