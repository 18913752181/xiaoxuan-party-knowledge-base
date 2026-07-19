import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getContentUnitBySlug, getContentUnitDownloadFilePath, updateContentUnitCounter } from "@/lib/content-units";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function encodeDownloadName(name: string) {
  return encodeURIComponent(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-"));
}

function contentType(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".ppt") return "application/vnd.ms-powerpoint";
  if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".pdf") return "application/pdf";
  return "application/octet-stream";
}

function downloadFileName(headerName: string) {
  const encoded = encodeDownloadName(headerName);
  return `attachment; filename*=UTF-8''${encoded}`;
}

async function requireUser(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: NextResponse.json({ error: "下载功能暂未配置登录服务。" }, { status: 503 }) };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: "请先登录后再下载文件。" }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, response: NextResponse.json({ error: "登录状态已失效，请重新登录后下载。" }, { status: 401 }) };
  }

  return { ok: true };
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const slug = decodeURIComponent(params.id).replace(/^content-/, "");
  const unit = await getContentUnitBySlug(slug);
  if (!unit) return NextResponse.json({ error: "没有找到资料。" }, { status: 404 });

  const result = await getContentUnitDownloadFilePath(slug);
  if (!result) return NextResponse.json({ error: "该资料暂未上传可下载文件。" }, { status: 404 });

  const buffer = await readFile(result.path);
  const fileName = result.file?.originalName || `${result.title}${path.extname(result.path)}`;

  updateContentUnitCounter(slug, "downloadCount", 1).catch((error) => {
    console.error("Failed to update download count", error);
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType(fileName),
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": downloadFileName(fileName),
      "Cache-Control": "private, no-store"
    }
  });
}
