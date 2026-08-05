"use client";

import type { Material } from "@/lib/types";

export type DownloadResult = {
  ok: boolean;
  error?: string;
  needsLogin?: boolean;
  membershipRequired?: boolean;
};

export type RecordedDownload = {
  article_slug: string;
  title: string;
  category: string;
  file_type: string;
  downloaded_at: string;
};

const DOWNLOADS_KEY = "xiaoxuan_downloads";

export function listRecordedDownloads(userId: string) {
  if (typeof window === "undefined" || !userId) return [] as RecordedDownload[];
  try {
    return JSON.parse(window.localStorage.getItem(`${DOWNLOADS_KEY}_${userId}`) || "[]") as RecordedDownload[];
  } catch {
    return [];
  }
}

export async function listServerDownloads(): Promise<RecordedDownload[]> {
  try {
    const response = await fetch("/api/downloads", { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return ((data.rows || []) as Array<{
      article_slug: string;
      title: string;
      category: string;
      file_type: string;
      created_at: string;
    }>).map((row) => ({
      article_slug: row.article_slug,
      title: row.title,
      category: row.category,
      file_type: row.file_type,
      downloaded_at: row.created_at
    }));
  } catch {
    return [];
  }
}

function rememberDownloadLocally(userId: string, material: Material) {
  const articleSlug = material.slug || material.id;
  const current = listRecordedDownloads(userId).filter((item) => item.article_slug !== articleSlug);
  const next: RecordedDownload[] = [{
    article_slug: articleSlug,
    title: material.title,
    category: material.topic || material.category,
    file_type: material.file_type,
    downloaded_at: new Date().toISOString()
  }, ...current].slice(0, 100);
  window.localStorage.setItem(`${DOWNLOADS_KEY}_${userId}`, JSON.stringify(next));
}

async function rememberDownload(material: Material) {
  try {
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    if (!sessionResponse.ok) return;
    const session = await sessionResponse.json();
    const userId = String(session.user?.id || "");
    if (!userId) return;

    // 记录跟随账号保存在服务端，换设备/换浏览器也还在；
    // 服务端不可用时回退到浏览器本地，保证“能看到记录”。
    const articleSlug = material.slug || material.id;
    const response = await fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articleSlug,
        title: material.title,
        category: material.topic || material.category,
        fileType: material.file_type
      })
    });
    if (!response.ok) rememberDownloadLocally(userId, material);
  } catch {
    // 下载成功优先，记录失败不影响用户取得文件。
  }
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
}

function fileNameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return safeFileName(fallback);

  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return safeFileName(decodeURIComponent(encodedMatch[1]));
    } catch {
      return safeFileName(encodedMatch[1]);
    }
  }

  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return safeFileName(plainMatch?.[1] || fallback);
}

export async function downloadAuthenticatedUrl(url: string, fallbackFileName: string): Promise<DownloadResult> {
  const response = await fetch(url, { credentials: "same-origin" });

  if (response.status === 401) {
    return { ok: false, error: "登录状态已失效，请重新登录后下载。", needsLogin: true };
  }

  if (!response.ok) {
    let error = "";
    let code = "";
    try {
      const body = await response.json();
      error = body?.error || body?.message || `下载失败：${response.status}`;
      code = body?.code || "";
    } catch {
      error = `下载失败：${response.status}`;
    }
    return { ok: false, error, membershipRequired: code === "MEMBERSHIP_REQUIRED" };
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileNameFromDisposition(response.headers.get("content-disposition"), fallbackFileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);

  return { ok: true };
}

export async function downloadMaterialFile(material: Material): Promise<DownloadResult> {
  if (!material.file_url) return { ok: false, error: "该资料暂未上传可下载文件。" };
  const result = await downloadAuthenticatedUrl(material.file_url, material.file_name || material.title);
  if (result.ok) await rememberDownload(material);
  return result;
}
