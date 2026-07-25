"use client";

import type { Material } from "@/lib/types";

export type FavoriteRow = {
  id: string;
  user_id: string;
  article_slug: string;
  title: string;
  category: string;
  created_at: string;
};

export type ToggleFavoriteResult = {
  ok: boolean;
  favorited: boolean;
  favoriteCount?: number;
  error: string;
};

export function getArticleSlug(material: Pick<Material, "id" | "slug">) {
  return material.slug || material.id;
}

function formatSupabaseError(message: string) {
  if (message.toLowerCase().includes("favorites")) {
    return `${message}。请确认 Supabase 已创建 favorites 表并开启 RLS 策略。`;
  }
  return message;
}

async function updateLocalFavoriteCount(articleSlug: string, delta: 1 | -1) {
  const response = await fetch(`/api/content-units/${encodeURIComponent(articleSlug)}/counter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field: "favoriteCount", delta })
  });

  if (!response.ok) return undefined;
  const data = await response.json();
  return typeof data.value === "number" ? data.value : undefined;
}

export async function getCurrentUserId() {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) return { userId: "", error: "登录后可收藏" };
  const data = await response.json();
  return { userId: data.user?.id || "", error: data.user?.id ? "" : "登录后可收藏" };
}

export async function listMyFavorites() {
  const response = await fetch("/api/favorites", { cache: "no-store" });
  const result = await response.json().catch(() => ({ rows: [], error: "收藏读取失败。" }));
  return {
    rows: (result.rows || []) as FavoriteRow[],
    error: response.ok ? result.error || "" : result.error || "登录后可收藏"
  };
}

export async function toggleFavorite(
  material: Material,
  currentFavoriteSlugs: string[]
): Promise<ToggleFavoriteResult> {
  const articleSlug = getArticleSlug(material);
  const isFavorited = currentFavoriteSlugs.includes(articleSlug);
  const response = await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articleSlug,
      title: material.title,
      category: material.category
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      favorited: isFavorited,
      error: formatSupabaseError(result.error || "收藏操作失败。")
    };
  }

  const favoriteCount = await updateLocalFavoriteCount(articleSlug, result.favorited ? 1 : -1);
  return { ok: true, favorited: Boolean(result.favorited), favoriteCount, error: "" };
}
