"use client";

import type { Material } from "@/lib/types";
import { missingSupabaseEnv, supabase } from "@/lib/supabase/client";

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
  if (missingSupabaseEnv.length > 0 || !supabase) {
    return { userId: "", error: `缺少环境变量：${missingSupabaseEnv.join(", ")}` };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) return { userId: "", error: error.message };
  if (!data.session?.user) return { userId: "", error: "登录后可收藏" };

  return { userId: data.session.user.id, error: "" };
}

export async function listMyFavorites() {
  const { userId, error } = await getCurrentUserId();
  if (error) return { rows: [] as FavoriteRow[], error };

  const { data, error: queryError } = await supabase!
    .from("favorites")
    .select("id,user_id,article_slug,title,category,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (queryError) {
    return { rows: [] as FavoriteRow[], error: formatSupabaseError(queryError.message) };
  }

  return { rows: (data || []) as FavoriteRow[], error: "" };
}

export async function toggleFavorite(
  material: Material,
  currentFavoriteSlugs: string[]
): Promise<ToggleFavoriteResult> {
  const { userId, error } = await getCurrentUserId();
  if (error) return { ok: false, favorited: false, error };

  const articleSlug = getArticleSlug(material);
  const isFavorited = currentFavoriteSlugs.includes(articleSlug);

  if (isFavorited) {
    const { error: deleteError } = await supabase!
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("article_slug", articleSlug);

    if (deleteError) {
      return {
        ok: false,
        favorited: true,
        error: formatSupabaseError(deleteError.message)
      };
    }

    const favoriteCount = await updateLocalFavoriteCount(articleSlug, -1);
    return { ok: true, favorited: false, favoriteCount, error: "" };
  }

  const { error: insertError } = await supabase!.from("favorites").insert({
    user_id: userId,
    article_slug: articleSlug,
    title: material.title,
    category: material.category
  });

  if (insertError) {
    return {
      ok: false,
      favorited: false,
      error: formatSupabaseError(insertError.message)
    };
  }

  const favoriteCount = await updateLocalFavoriteCount(articleSlug, 1);
  return { ok: true, favorited: true, favoriteCount, error: "" };
}
