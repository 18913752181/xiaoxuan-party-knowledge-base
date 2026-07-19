"use client";

import { supabase } from "@/lib/supabase/client";
import type { Material } from "@/lib/types";

export type DownloadResult = {
  ok: boolean;
  error?: string;
  needsLogin?: boolean;
};

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

async function responseError(response: Response) {
  try {
    const body = await response.json();
    return body?.error || body?.message || `下载失败：${response.status}`;
  } catch {
    return `下载失败：${response.status}`;
  }
}

async function getAccessToken(): Promise<DownloadResult & { token?: string }> {
  if (!supabase) return { ok: false, error: "登录服务暂未配置，暂时不能下载。" };

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    return { ok: false, error: "请先登录后再下载文件。", needsLogin: true };
  }

  return { ok: true, token: data.session.access_token };
}

export async function downloadAuthenticatedUrl(url: string, fallbackFileName: string): Promise<DownloadResult> {
  const session = await getAccessToken();
  if (!session.ok || !session.token) return session;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  });

  if (response.status === 401) {
    return { ok: false, error: "登录状态已失效，请重新登录后下载。", needsLogin: true };
  }

  if (!response.ok) {
    return { ok: false, error: await responseError(response) };
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
  if (material.member_only) return { ok: false, error: "该资料为会员专属，后续开放。" };
  if (!material.file_url) return { ok: false, error: "该资料暂未上传可下载文件。" };
  return downloadAuthenticatedUrl(material.file_url, material.file_name || material.title);
}
