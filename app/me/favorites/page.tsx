"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Material } from "@/lib/types";
import { listFavorites, listMaterials } from "@/lib/library-store";

export default function FavoritesPage() {
  const { profile } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      setMaterials(await listMaterials());
      setFavoriteIds(await listFavorites(profile?.id));
    }
    load();
  }, [profile?.id]);

  const favorites = useMemo(() => materials.filter((item) => favoriteIds.includes(item.id)), [favoriteIds, materials]);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
      <h1 className="text-3xl font-semibold text-brand-ink">我的收藏</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {favorites.map((material) => (
          <Link key={material.id} href={`/materials/${material.id}`} className="rounded-2xl border border-brand-line bg-white p-5 shadow-soft">
            <p className="text-sm text-brand-sageDark">{material.category}</p>
            <h2 className="mt-2 text-xl font-semibold text-brand-ink">{material.title}</h2>
            <p className="mt-3 text-sm leading-7 text-neutral-600">{material.description}</p>
          </Link>
        ))}
      </div>
      {favorites.length === 0 ? <p className="mt-8 rounded-2xl bg-white p-8 text-neutral-500 shadow-soft">还没有收藏资料。</p> : null}
    </section>
  );
}
