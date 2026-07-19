"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { downloadMaterialFile } from "@/lib/download-file";
import { getArticleSlug, listMyFavorites, toggleFavorite } from "@/lib/favorites";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";

function blocks(text?: string) {
  if (!text) return null;
  return text.split(/\n{2,}/).map((item) => <p key={item} className="whitespace-pre-wrap leading-8 text-neutral-700">{item.trim()}</p>);
}

function hasKnowledgeContent(text?: string) {
  const value = (text || "").trim();
  return Boolean(value && value !== "待补充" && value !== "暂无" && value !== "无");
}

function cleanNetworkItems(items?: string[]) {
  return (items || []).map((item) => item.trim()).filter((item) => item && !["无", "暂无", "待补充"].includes(item));
}

function isPolicyMaterial(item: Material) {
  const text = [item.title, item.file_name].join(" ");
  return /制度|条例|规定|办法|细则|准则|意见|规范/.test(text);
}

export default function MaterialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [material, setMaterial] = useState<Material | null>(null);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/content-units/${encodeURIComponent(params.id)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((row) => setMaterial(row))
      .catch(() => setMaterial(null));

    fetch("/api/content-units", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => setAllMaterials(Array.isArray(rows) ? rows : []))
      .catch(() => setAllMaterials([]));

    listMyFavorites().then(({ rows, error }) => {
      if (!error) setFavoriteSlugs(rows.map((row) => row.article_slug));
    });
  }, [params.id]);

  async function onToggleFavorite() {
    if (!material) return;
    const result = await toggleFavorite(material, favoriteSlugs);
    if (!result.ok) return setMessage(result.error);
    const articleSlug = getArticleSlug(material);
    setFavoriteSlugs((current) => result.favorited ? [...current, articleSlug] : current.filter((slug) => slug !== articleSlug));
    if (typeof result.favoriteCount === "number") setMaterial((current) => current ? { ...current, favorite_count: result.favoriteCount! } : current);
    setMessage(result.favorited ? "已收藏。" : "已取消收藏。");
  }

  async function download() {
    if (!material) return;
    setMessage("正在准备下载...");
    const result = await downloadMaterialFile(material);
    if (!result.ok) {
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) window.setTimeout(() => router.push("/login"), 800);
      return;
    }

    setMaterial((current) => current ? { ...current, download_count: current.download_count + 1 } : current);
    setMessage("文件下载已开始。");
  }

  if (!material) return <section className="mx-auto max-w-4xl px-5 py-12 text-neutral-600">没有找到这份资料。</section>;

  const articleSlug = getArticleSlug(material);
  const isFavorite = favoriteSlugs.includes(articleSlug);
  const scenarioContent = material.scenarios || material.introduction || material.article;
  const policyContent = material.policyBasis || material.legal_basis;
  const noticeContent = material.notices || material.downloadNote;
  const findLinkedMaterial = (title: string) => {
    const normalized = title.trim();
    if (!normalized) return null;
    return allMaterials.find((item) => item.title === normalized)
      || allMaterials.find((item) => item.title.includes(normalized) || normalized.includes(item.title))
      || null;
  };
  const previousItems = cleanNetworkItems(material.relatedMap?.previous);
  const nextItems = cleanNetworkItems(material.relatedMap?.next);
  const recommendedPolicyMaterials = cleanNetworkItems(material.relatedMap?.recommended)
    .map(findLinkedMaterial)
    .filter((item): item is Material => Boolean(item && isPolicyMaterial(item)));
  const automaticPolicyMaterials = allMaterials.filter((item) =>
    item.id !== material.id
    && (item.topic || item.category) === (material.topic || material.category)
    && isPolicyMaterial(item)
    && Boolean(item.file_url || item.downloadable)
  );
  const policyMaterials = [...recommendedPolicyMaterials, ...automaticPolicyMaterials]
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6);
  const hasKnowledgeNetwork = previousItems.length > 0 || nextItems.length > 0 || policyMaterials.length > 0;

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <Link href="/library" className="text-sm font-medium text-[#6f8b7b]">返回资料库</Link>

      <article className="mt-5 overflow-hidden rounded-[2rem] border border-[#ebe5dc] bg-white shadow-[0_18px_60px_rgba(68,57,45,0.08)]">
        <div className="bg-[#fbfaf6] p-6 md:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-2xl bg-[#edf3ef] px-4 py-2 text-sm font-semibold text-[#4f6f62]">{material.file_type}</span>
            {material.member_only ? <span className="rounded-2xl bg-[#f4ede1] px-4 py-2 text-sm font-medium text-[#8a6b50]">会员专属</span> : null}
            <span className="rounded-2xl bg-white px-4 py-2 text-sm text-neutral-600">{material.topic || material.category}</span>
            {material.stage ? <span className="rounded-2xl bg-white px-4 py-2 text-sm text-neutral-600">{material.stage}</span> : null}
          </div>

          <h1 className="mt-6 max-w-4xl text-3xl font-semibold leading-tight tracking-tight text-brand-ink md:text-5xl">{material.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-neutral-600">{material.description}</p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button type="button" onClick={download} className="rounded-2xl bg-[#6f8b7b] px-7 py-3 text-sm font-medium text-white shadow-sm hover:bg-[#49695c]">
              下载文件
            </button>
            <button type="button" onClick={onToggleFavorite} className={`rounded-2xl border px-6 py-3 text-sm ${isFavorite ? "border-[#c79b52] bg-[#fff8e8] text-[#8a6b50]" : "border-[#ebe5dc] bg-white text-neutral-600"}`}>
              {isFavorite ? "已收藏" : "收藏资料"}
            </button>
          </div>

          {message ? <p className="mt-5 rounded-2xl bg-[#fffaf1] px-4 py-3 text-sm text-[#7a633f]">{message}</p> : null}

          <div className="mt-7 grid gap-3 rounded-[1.5rem] bg-white p-5 text-sm text-neutral-600 sm:grid-cols-2 lg:grid-cols-3">
            <p>文件名：{material.file_name || "暂无文件名"}</p>
            <p>更新：{formatDisplayDay(material.updated_at)}</p>
            <p>专题：{material.topic || material.category}</p>
            <p>下载数：{material.download_count}</p>
            <p>收藏数：{material.favorite_count}</p>
          </div>
        </div>

        <div className="grid gap-6 p-6 md:p-8">
          {hasKnowledgeContent(scenarioContent) ? <DetailSection title="什么时候用">{blocks(scenarioContent)}</DetailSection> : null}
          {hasKnowledgeContent(material.process) ? <DetailSection title="怎么用">{blocks(material.process)}</DetailSection> : null}
          {hasKnowledgeContent(policyContent) ? <DetailSection title="制度依据">{blocks(policyContent)}</DetailSection> : null}
          {hasKnowledgeContent(noticeContent) ? <DetailSection title="填写说明与注意事项">{blocks(noticeContent)}</DetailSection> : null}
          {hasKnowledgeContent(material.faq) ? <DetailSection title="常见问题">{blocks(material.faq)}</DetailSection> : null}
          {hasKnowledgeContent(material.note) ? <DetailSection title="小宣提醒">{blocks(material.note)}</DetailSection> : null}

          {hasKnowledgeNetwork ? <section id="knowledge-network" className="rounded-[1.75rem] border border-[#ebe5dc] bg-[#fbfaf6] p-6">
            <p className="text-sm font-medium text-[#6f8b7b]">关联知识</p>
            <h2 className="mt-2 text-2xl font-semibold text-brand-ink">知识网络</h2>
            <p className="mt-3 leading-8 text-neutral-700">{material.topic || material.category}{material.stage ? ` > ${material.stage}` : ""} &gt; {material.title}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {previousItems.length ? <NetworkList title="上一步工作" items={previousItems} findMaterial={findLinkedMaterial} /> : null}
              {nextItems.length ? <NetworkList title="下一步工作" items={nextItems} findMaterial={findLinkedMaterial} /> : null}
              {policyMaterials.length ? <PolicyFileList items={policyMaterials} /> : null}
            </div>
          </section> : null}
        </div>
      </article>
    </section>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.75rem] border border-[#ebe5dc] bg-white p-6"><h2 className="text-2xl font-semibold text-brand-ink">{title}</h2><div className="mt-4 grid gap-4">{children}</div></section>;
}

function NetworkList({ title, items, findMaterial }: { title: string; items: string[]; findMaterial: (title: string) => Material | null }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <h3 className="font-semibold text-brand-ink">{title}</h3>
      <ul className="mt-3 grid gap-2 text-sm text-neutral-700">
        {items.map((item) => {
          const linkedMaterial = findMaterial(item);
          return <li key={item}>{linkedMaterial ? <Link href={`/materials/${linkedMaterial.slug || linkedMaterial.id}`} className="text-[#5f7f70] hover:text-[#49695c]">{item}</Link> : <span>{item}</span>}</li>;
        })}
      </ul>
    </div>
  );
}

function PolicyFileList({ items }: { items: Material[] }) {
  return <div className="rounded-2xl bg-white p-4 md:col-span-2">
    <h3 className="font-semibold text-brand-ink">制度文件</h3>
    <ul className="mt-3 grid gap-2 text-sm">
      {items.map((item) => <li key={item.id}><Link href={`/materials/${item.slug || item.id}`} className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f4ee] px-4 py-3 text-[#5f7f70] hover:text-[#49695c]"><span>{item.title}</span><span className="shrink-0 text-xs">查看下载 →</span></Link></li>)}
    </ul>
  </div>;
}
