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
      <div className="flex items-center gap-2.5">
        <span className="h-6 w-1.5 rounded-full bg-[#9a4650]" aria-hidden="true" />
        <h1 className="text-3xl font-semibold text-brand-ink">我的收藏</h1>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {favorites.map((favorite) => (
          <Link
            key={favorite.id}
            href={`/materials/${favorite.article_slug}`}
            className="rounded-2xl border border-brand-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-[#c9a2a6] hover:shadow-md"
          >
            <p className="text-sm text-[#9a4650]">{favorite.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-brand-ink">{favorite.title}</h2>
            <p className="mt-3 text-sm text-neutral-500">收藏于 {new Date(favorite.created_at).toLocaleString("zh-CN")}</p>
          </Link>
        ))}
      </div>
      {favorites.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-brand-line bg-white p-10 text-center shadow-soft">
          <p className="text-neutral-500">还没有收藏资料。</p>
          <Link href="/library" className="mt-4 inline-flex rounded-xl bg-[#9a4650] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#7d3540]">
            去资料库看看
          </Link>
        </div>
      ) : null}
    </section>
  );
}
