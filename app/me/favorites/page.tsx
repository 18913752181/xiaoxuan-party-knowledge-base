"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listMyFavorites, type FavoriteRow } from "@/lib/favorites";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);

  useEffect(() => {
    listMyFavorites().then(({ rows }) => setFavorites(rows));
  }, []);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold text-brand-ink">我的收藏</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {favorites.map((favorite) => (
          <Link key={favorite.id} href={`/materials/${favorite.article_slug}`} className="rounded-2xl border border-brand-line bg-white p-5 shadow-soft">
            <p className="text-sm text-brand-sageDark">{favorite.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-brand-ink">{favorite.title}</h2>
            <p className="mt-3 text-sm text-neutral-500">收藏于 {new Date(favorite.created_at).toLocaleString("zh-CN")}</p>
          </Link>
        ))}
      </div>
      {favorites.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-8 text-neutral-500 shadow-soft">还没有收藏资料。</p> : null}
    </section>
  );
}
