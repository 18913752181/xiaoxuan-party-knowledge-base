"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadMaterialFile } from "@/lib/download-file";
import { getArticleSlug, listMyFavorites, toggleFavorite } from "@/lib/favorites";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";

const topicAllOption = "专题";
const vipOptions = [
  { value: "all", label: "是否会员专属" },
  { value: "free", label: "普通下载" },
  { value: "member", label: "会员专属" }
];
const sortOptions = [
  { value: "newest", label: "最新更新" },
  { value: "downloads", label: "下载最多" },
  { value: "favorites", label: "收藏最多" }
];

function fileTone(fileType: string) {
  const tones: Record<string, string> = {
    Word: "bg-[#edf3ef] text-[#4f6f62]",
    Excel: "bg-[#edf3f3] text-[#507370]",
    PDF: "bg-[#f5eee6] text-[#8a6b50]",
    PPT: "bg-[#f4ede1] text-[#8a6b50]"
  };
  return tones[fileType] || "bg-neutral-100 text-neutral-600";
}

export function ResourceLibrary({ initialTopic = "" }: { initialTopic?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  const [topic, setTopic] = useState(initialTopic || searchParams.get("topic") || topicAllOption);
  const [vipFilter, setVipFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/content-units", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("资料读取失败");
        return response.json();
      })
      .then((rows) => setMaterials(Array.isArray(rows) ? rows : []))
      .catch((error) => setMessage(`资料读取失败：${error.message}`));

    listMyFavorites().then(({ rows, error }) => {
      if (!error) setFavoriteSlugs(rows.map((row) => row.article_slug));
    });
  }, []);

  useEffect(() => setTopic(initialTopic || searchParams.get("topic") || topicAllOption), [initialTopic, searchParams]);

  function updateMaterialCount(articleSlug: string, field: "download_count" | "favorite_count", value: number) {
    setMaterials((current) => current.map((item) => (getArticleSlug(item) === articleSlug ? { ...item, [field]: value } : item)));
  }

  const topics = useMemo(() => [topicAllOption, ...Array.from(new Set(materials.map((item) => item.topic || item.category).filter(Boolean)))], [materials]);

  const filteredMaterials = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return materials
      .filter((material) => {
        const materialTopic = material.topic || material.category;
        const searchableText = [material.title, material.description, material.summary, material.category, materialTopic, material.stage, material.file_type, material.file_name, ...(material.tags || [])]
          .join(" ")
          .toLowerCase();
        return (
          (topic === topicAllOption || materialTopic === topic) &&
          (vipFilter === "all" || (vipFilter === "member" && isMemberOnly(material)) || (vipFilter === "free" && !isMemberOnly(material))) &&
          (!query || searchableText.includes(query))
        );
      })
      .sort((a, b) => {
        if (sortBy === "downloads") return numericCount(b.download_count) - numericCount(a.download_count);
        if (sortBy === "favorites") return numericCount(b.favorite_count) - numericCount(a.favorite_count);
        return dateValue(b.updated_at || b.uploaded_at) - dateValue(a.updated_at || a.uploaded_at);
      });
  }, [keyword, materials, sortBy, topic, vipFilter]);

  async function onToggleFavorite(material: Material) {
    const result = await toggleFavorite(material, favoriteSlugs);
    if (!result.ok) return setMessage(result.error);
    const articleSlug = getArticleSlug(material);
    setFavoriteSlugs((current) => (result.favorited ? [...current, articleSlug] : current.filter((slug) => slug !== articleSlug)));
    if (typeof result.favoriteCount === "number") updateMaterialCount(articleSlug, "favorite_count", result.favoriteCount);
    setMessage(result.favorited ? "已收藏。" : "已取消收藏。");
  }

  async function download(material: Material) {
    setMessage("正在准备下载...");
    const result = await downloadMaterialFile(material);
    if (!result.ok) {
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) window.setTimeout(() => router.push("/login"), 800);
      return;
    }

    const articleSlug = getArticleSlug(material);
    updateMaterialCount(articleSlug, "download_count", material.download_count + 1);
    setMessage("文件下载已开始。");
  }

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-[#ebe5dc] bg-white/88 p-6 shadow-sm md:p-8">
        <p className="text-sm font-medium text-[#6f8b7b]">小宣资料库</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">找到需要的党建资料</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-600">按专题查找常用文件、制度材料和工作模板，支持收藏与下载。</p>
        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_170px_170px_140px]">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索资料名称、专题或文件类型" className="h-12 rounded-2xl bg-[#f7f4ee] px-5 text-sm text-brand-ink outline-none placeholder:text-neutral-400" />
          <Select value={topic} onChange={setTopic} options={topics} />
          <Select value={vipFilter} onChange={setVipFilter} options={vipOptions.map((item) => item.value)} labels={Object.fromEntries(vipOptions.map((item) => [item.value, item.label]))} />
          <Select value={sortBy} onChange={setSortBy} options={sortOptions.map((item) => item.value)} labels={Object.fromEntries(sortOptions.map((item) => [item.value, item.label]))} />
        </div>
      </div>

      {message ? <div className="mb-5 rounded-2xl border border-[#d9cab1] bg-[#fffaf1] px-5 py-4 text-sm text-[#7a633f]">{message}</div> : null}
      <div className="mb-5 flex items-center justify-between text-sm text-neutral-500"><span>共 {filteredMaterials.length} 份资料</span><span>已收藏 {favoriteSlugs.length} 份</span></div>

      <div className="grid gap-4 md:grid-cols-2">
        {filteredMaterials.map((material) => {
          const articleSlug = getArticleSlug(material);
          const isFavorite = favoriteSlugs.includes(articleSlug);
          return (
            <article key={material.id} className="rounded-[1.75rem] border border-[#ebe5dc] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${fileTone(material.file_type)}`}>{material.file_type}</span>
                    {material.member_only ? <span className="rounded-full bg-[#f4ede1] px-3 py-1 text-xs font-medium text-[#8a6b50]">会员专属</span> : null}
                    <span className="rounded-full bg-[#f7f4ee] px-3 py-1 text-xs font-medium text-neutral-600">{material.topic || material.category}</span>
                  </div>
                  <Link href={`/materials/${articleSlug}`} className="text-xl font-semibold leading-8 text-brand-ink hover:text-[#49695c]">{material.title}</Link>
                </div>
                <button type="button" onClick={() => onToggleFavorite(material)} aria-label={isFavorite ? "取消收藏" : "收藏资料"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg transition ${isFavorite ? "border-[#c79b52] bg-[#fff8e8] text-[#b1843e]" : "border-[#ebe5dc] bg-[#fbfaf6] text-neutral-400 hover:border-[#c79b52] hover:text-[#b1843e]"}`}>{isFavorite ? "★" : "☆"}</button>
              </div>
              <p className="mt-4 min-h-14 text-sm leading-7 text-neutral-600">{material.description}</p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#ebe5dc] pt-4 text-xs text-neutral-500">
                <span>更新 {formatDisplayDay(material.updated_at)}</span>
                <span>下载数 {material.download_count}</span>
                <span>收藏数 {material.favorite_count}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => download(material)} className="rounded-2xl bg-[#6f8b7b] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#49695c]">下载文件</button>
                <Link href={`/materials/${articleSlug}`} className="rounded-2xl border border-[#ebe5dc] bg-[#fbfaf6] px-5 py-2.5 text-sm text-neutral-600">查看详情</Link>
              </div>
            </article>
          );
        })}
      </div>
      {filteredMaterials.length === 0 ? <div className="mt-10 rounded-[1.75rem] border border-[#ebe5dc] bg-white p-10 text-center text-neutral-500 shadow-sm">还没有找到匹配资料。请调整关键词或专题。</div> : null}
    </section>
  );
}

function Select({ value, onChange, options, labels }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-2xl border border-[#ebe5dc] bg-white px-4 text-sm text-neutral-600 outline-none">{options.map((option) => <option key={option} value={option}>{labels?.[option] || option}</option>)}</select>;
}

function isMemberOnly(material: Material) {
  return material.member_only === true || material.isVip === true;
}

function numericCount(value: number | undefined) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function dateValue(value?: string) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
