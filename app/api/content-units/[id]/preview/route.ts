import { NextResponse } from "next/server";
import { getContentUnitDownloadFilePath } from "@/lib/content-units";
import { materialPreview, supportsMaterialPreview } from "@/lib/material-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const file = await getContentUnitDownloadFilePath(params.id.replace(/^content-/, ""));
    if (!file || !supportsMaterialPreview(file.path)) {
      return NextResponse.json({ error: "该资料暂不支持预览。" }, { status: 404, headers });
    }
    const image = await materialPreview(file.path);
    return new NextResponse(new Uint8Array(image), { headers: { ...headers, "Content-Type": "image/png" } });
  } catch (error) {
    console.error("Material preview failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "预览暂时不可用，请稍后重试。" }, { status: 503, headers });
  }
}
