"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { downloadMaterialFile, downloadMaterialsAsZip } from "@/lib/download-file";
import { getArticleSlug, listMyFavorites, toggleFavorite } from "@/lib/favorites";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";
import { FileTypeIcon } from "@/components/FileTypeIcon";
import { DimmoCompanion } from "@/components/DimmoCompanion";
import SupportCard, { shouldShowSupportCard } from "@/components/SupportCard";

const topicAllOption = "全部专题";
const preferredTopics = ["发展党员", "主题党日", "换届选举", "三会一课", "组织生活会", "支部建设"];
const libraryPageSize = 12;
type SortMode = "updated" | "popular";

/** 数量按量级展示，不暴露精确值：9 → 9+，67 → 60+，934 → 900+ */
function magnitudeLabel(value: number) {
  if (value <= 0) return "0";
  if (value < 10) return `${value}+`;
  const step = 10 ** Math.floor(Math.log10(value));
  return `${Math.floor(value / step) * step}+`;
}

export function ResourceLibrary({
  initialMaterials = [],
  initialKeyword = "",
  initialTopic = "",
  libraryOnly = false
}: {
  initialMaterials?: Material[];
  initialKeyword?: string;
  initialTopic?: string;
  libraryOnly?: boolean;
}) {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [submittedKeyword, setSubmittedKeyword] = useState(initialKeyword);
  const [topic, setTopic] = useState(initialTopic || topicAllOption);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(initialMaterials.length === 0);
  const [page, setPage] = useState(1);
  const [memberOnlyMaterial, setMemberOnlyMaterial] = useState<Material | null>(null);
  const [supportMaterial, setSupportMaterial] = useState<Material | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  useEffect(() => {
    if (!initialMaterials.length) {
      fetch("/api/content-units")
        .then((response) => {
          if (!response.ok) throw new Error("资料读取失败");
          return response.json();
        })
        .then((rows) => setMaterials(Array.isArray(rows) ? rows : []))
        .catch((error) => setMessage(`资料读取失败：${error.message}`))
        .finally(() => setIsLoading(false));
    }

    listMyFavorites().then(({ rows, error }) => {
      if (!error) setFavoriteSlugs(rows.map((row) => row.article_slug));
    });
  }, [initialMaterials.length]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlKeyword = params.get("q") || initialKeyword;
    setKeyword(urlKeyword);
    setSubmittedKeyword(urlKeyword);
    setTopic(initialTopic || params.get("topic") || topicAllOption);
  }, [initialKeyword, initialTopic]);

  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => dateValue(b.updated_at || b.uploaded_at) - dateValue(a.updated_at || a.uploaded_at)),
    [materials]
  );
  const popularMaterials = useMemo(
    () => [...materials].sort((a, b) => popularity(b) - popularity(a)),
    [materials]
  );
  const displayMaterials = libraryOnly && sortMode === "popular" ? popularMaterials : sortedMaterials;

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    materials.forEach((item) => {
      const name = item.topic || item.category;
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return counts;
  }, [materials]);

  const totalDownloads = useMemo(
    () => materials.reduce((sum, item) => sum + Number(item.download_count || 0), 0),
    [materials]
  );

  const frequentTopics = useMemo(() => {
    const eligible = Array.from(topicCounts.entries()).filter(([, count]) => count >= 2);
    return eligible
      .sort(([a, countA], [b, countB]) => {
        const priorityA = preferredTopics.indexOf(a);
        const priorityB = preferredTopics.indexOf(b);
        if (priorityA >= 0 || priorityB >= 0) return (priorityA < 0 ? 99 : priorityA) - (priorityB < 0 ? 99 : priorityB);
        return countB - countA;
      })
      .slice(0, 6);
  }, [topicCounts]);

  const filteredMaterials = useMemo(() => {
    const query = submittedKeyword.trim().toLowerCase();
    return displayMaterials.filter((material) => {
      const materialTopic = material.topic || material.category;
      const searchableText = [material.title, material.description, material.summary, material.category, materialTopic, material.stage, material.file_type, material.file_name, ...(material.tags || [])]
        .join(" ")
        .toLowerCase();
      return (topic === topicAllOption || materialTopic === topic) && (!query || searchableText.includes(query));
    });
  }, [displayMaterials, submittedKeyword, topic]);

  useEffect(() => setPage(1), [submittedKeyword, topic, sortMode]);

  const totalPages = libraryOnly ? Math.max(1, Math.ceil(filteredMaterials.length / libraryPageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleMaterials = libraryOnly
    ? filteredMaterials.slice((currentPage - 1) * libraryPageSize, currentPage * libraryPageSize)
    : filteredMaterials.slice(0, 3);
  const downloadableVisibleMaterials = visibleMaterials.filter((material) => Boolean(material.file_url));
  const allVisibleSelected = downloadableVisibleMaterials.length > 0 && downloadableVisibleMaterials.every((material) => selectedSlugs.includes(getArticleSlug(material)));

  function changePage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), totalPages));
    window.requestAnimationFrame(() => document.getElementById("latest-materials")?.scrollIntoView({ block: "start" }));
  }

  const searchResults = useMemo(() => {
    const query = submittedKeyword.trim().toLowerCase();
    if (!query) return [];
    return displayMaterials
      .filter((material) => {
        const searchableText = [
          material.title,
          material.file_name,
          material.topic,
          material.category,
          material.description,
          material.summary,
          ...(material.tags || [])
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
  }, [displayMaterials, submittedKeyword]);

  const showSearchMode = !libraryOnly && Boolean(submittedKeyword.trim());

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedKeyword(keyword.trim());
  }

  function clearSearch() {
    setKeyword("");
    setSubmittedKeyword("");
  }

  function updateMaterialCount(articleSlug: string, field: "download_count" | "favorite_count", value: number) {
    setMaterials((current) => current.map((item) => (getArticleSlug(item) === articleSlug ? { ...item, [field]: value } : item)));
  }

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
      if (result.membershipRequired) {
        setMemberOnlyMaterial(material);
        setMessage("");
        return;
      }
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) {
        const here = `${window.location.pathname}${window.location.search}`;
        window.setTimeout(() => router.push(`/login?redirect=${encodeURIComponent(here)}`), 800);
      }
      return;
    }
    updateMaterialCount(getArticleSlug(material), "download_count", material.download_count + 1);
    setMessage("文件下载已开始。");
    if (shouldShowSupportCard()) setSupportMaterial(material);
  }

  function toggleSelection(material: Material) {
    if (!material.file_url) return;
    const slug = getArticleSlug(material);
    setSelectedSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }

  function toggleVisibleSelection() {
    const visibleSlugs = downloadableVisibleMaterials.map(getArticleSlug);
    setSelectedSlugs((current) => allVisibleSelected
      ? current.filter((slug) => !visibleSlugs.includes(slug))
      : Array.from(new Set([...current, ...visibleSlugs]))
    );
  }

  async function batchDownload() {
    const selectedMaterials = materials.filter((material) => selectedSlugs.includes(getArticleSlug(material)) && material.file_url);
    if (!selectedMaterials.length) return setMessage("请先选择需要下载的资料。");

    setIsBatchDownloading(true);
    setMessage(`正在打包 ${selectedMaterials.length} 份资料，请稍候...`);
    setMemberOnlyMaterial(null);
    try {
      const result = await downloadMaterialsAsZip(selectedMaterials);
      const downloadedSlugs = result.downloaded.map(getArticleSlug);
      setSelectedSlugs((current) => current.filter((slug) => !downloadedSlugs.includes(slug)));
      result.downloaded.forEach((material) => {
        updateMaterialCount(getArticleSlug(material), "download_count", material.download_count + 1);
      });

      const loginFailure = result.failures.find((failure) => failure.needsLogin);
      const membershipFailure = result.failures.find((failure) => failure.membershipRequired);
      if (!result.ok && membershipFailure) {
        setMemberOnlyMaterial(membershipFailure.material);
        setMessage("");
      } else if (!result.ok) {
        setMessage(result.error || "批量下载失败，请稍后重试。");
      } else if (result.failures.length) {
        setMessage(`已打包 ${result.downloaded.length} 份资料，另有 ${result.failures.length} 份因权限或文件状态未能下载。`);
      } else {
        setMessage(`已将 ${result.downloaded.length} 份资料打包为 ZIP，下载已开始。`);
      }

      if (loginFailure) {
        const here = `${window.location.pathname}${window.location.search}`;
        window.setTimeout(() => router.push(`/login?redirect=${encodeURIComponent(here)}`), 800);
      }
    } catch {
      setMessage("资料打包失败，请稍后重试。");
    } finally {
      setIsBatchDownloading(false);
    }
  }

  return (
    <div className="xuan-shell">
      <section className={libraryOnly ? "bg-white" : "bg-brand-paper"}>
        <div className={`mx-auto px-5 ${libraryOnly ? "max-w-6xl py-8 lg:px-8 lg:py-10" : "max-w-5xl py-12 text-center lg:px-8 lg:py-16"}`}>
          {libraryOnly ? (
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-brand-ink md:text-4xl">全部资料</h1>
              <p className="mt-2 text-sm leading-7 text-neutral-600">按专题、更新时间和使用场景，快速找到可直接使用的资料。</p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
                <DimmoCompanion />
                <h1 className="xuan-display-title text-center text-4xl leading-tight text-brand-ink md:text-5xl">
                  工作资料，<span className="xuan-highlight">马上找到</span>
                </h1>
              </div>
            </div>
          )}
          <form onSubmit={submitSearch} className={`xuan-search-shell ${libraryOnly ? "mt-6 max-w-3xl" : "mt-8"} flex items-center rounded-3xl p-2 pl-5 transition-[border-color,box-shadow] duration-150`}>
            <span className="mr-3 text-xl text-neutral-400" aria-hidden="true">⌕</span>
            <label htmlFor="material-search" className="sr-only">搜索资料</label>
            <input id="material-search" type="search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索主题党日、发展党员、换届选举……" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-neutral-500 md:text-base" />
            {submittedKeyword ? <button type="button" onClick={clearSearch} className="h-12 shrink-0 px-3 text-sm text-neutral-400 transition-colors hover:text-brand-red">清除</button> : null}
            <button type="submit" className="h-12 shrink-0 rounded-2xl bg-brand-red px-5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98]">开始查找</button>
          </form>
          {showSearchMode ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#e7ded5] bg-white shadow-lg">
              <div className="border-b border-[#eeeae4] px-4 py-3 text-sm text-neutral-500">
                共找到 <span className="font-semibold text-[#9a4650]">{searchResults.length}</span> 份资料
              </div>
              {searchResults.length ? (
                <div className="divide-y divide-[#eeeae4]">
                  {searchResults.map((material) => {
                    const slug = getArticleSlug(material);
                    return (
                      <Link
                        key={material.id}
                        href={`/materials/${slug}`}
                        className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-[#faf6f2]"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-brand-ink">{displayMaterialTitle(material.title)}</span>
                          <span className="mt-1 block text-xs text-neutral-400">
                            {material.topic || material.category || "未分类"} · {material.file_type || "资料"}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs text-[#9a4650]">查看</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="px-4 py-5 text-center text-sm text-neutral-400">没有找到对应名称的资料</p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {!libraryOnly && !showSearchMode && !isLoading && materials.length >= 1000 ? (
        <div className="bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-7 gap-y-2 px-5 py-4 text-sm text-neutral-600 lg:px-8">
            <span><b className="font-semibold text-brand-ink">{magnitudeLabel(materials.length)}</b> 份常用资料</span>
            <span><b className="font-semibold text-brand-ink">{magnitudeLabel(topicCounts.size)}</b> 个工作专题</span>
            <span><b className="font-semibold text-brand-ink">{magnitudeLabel(totalDownloads)}</b> 次资料下载</span>
          </div>
        </div>
      ) : null}

      {showSearchMode ? null : <div className="mx-auto max-w-6xl space-y-11 px-5 py-9 lg:px-8 lg:py-12">
        {!libraryOnly && frequentTopics.length ? (
          <section>
            <SectionHeader title="高频工作" />
            <div className="mt-4 flex flex-wrap gap-2.5">
              {frequentTopics.map(([name]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => router.push(`/library?topic=${encodeURIComponent(name)}`)}
                  className="group inline-flex min-h-11 items-center rounded-xl border border-brand-line bg-white px-4 py-2.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 hover:border-[#d9dde2] hover:bg-[#fff8f8] hover:shadow-[0_8px_18px_rgba(35,43,52,0.035)] active:scale-[0.98]"
                >
                  <span className="text-sm font-medium text-brand-ink transition-colors duration-150 group-hover:text-brand-red">{name}</span>
                </button>
              ))}
              <Link
                href="/library"
                className="group inline-flex min-h-11 items-center rounded-xl border border-brand-line bg-white px-4 py-2.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 hover:border-[#d9dde2] hover:bg-[#fff8f8] hover:shadow-[0_8px_18px_rgba(35,43,52,0.035)] active:scale-[0.98]"
              >
                <span className="text-sm font-medium text-brand-ink transition-colors duration-150 group-hover:text-brand-red">更多</span>
              </Link>
            </div>
          </section>
        ) : null}

        <section id="latest-materials" className="scroll-mt-28">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader title={topic === topicAllOption ? (libraryOnly ? "资料列表" : "最新资料") : topic} subtitle={libraryOnly ? `共 ${filteredMaterials.length} 份` : undefined} />
            <div className="flex flex-wrap gap-2">
              {libraryOnly ? (
                <>
                  <label htmlFor="topic-filter" className="sr-only">按专题筛选资料</label>
                  <select id="topic-filter" value={topic} onChange={(event) => { setTopic(event.target.value); setMemberOnlyMaterial(null); }} className="h-11 rounded-xl border border-brand-line bg-white px-4 text-sm text-neutral-600 outline-none transition-colors focus:border-[#d9a6ac] focus:ring-2 focus:ring-[#f5d8db]">
                    <option value={topicAllOption}>{topicAllOption}</option>
                    {Array.from(topicCounts.keys()).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </>
              ) : <Link href="/library" className="group inline-flex min-h-11 items-center rounded-xl border border-brand-line bg-white px-4 py-2.5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 hover:border-[#d9dde2] hover:bg-[#fff8f8] hover:shadow-[0_8px_18px_rgba(35,43,52,0.035)] active:scale-[0.98]"><span className="text-sm font-medium text-brand-ink transition-colors duration-150 group-hover:text-brand-red">全部专题</span></Link>}
              {libraryOnly ? (
                <>
                  <label htmlFor="sort-filter" className="sr-only">资料排序</label>
                  <select id="sort-filter" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-11 rounded-xl border border-brand-line bg-white px-4 text-sm text-neutral-600 outline-none transition-colors focus:border-[#d9a6ac] focus:ring-2 focus:ring-[#f5d8db]">
                    <option value="updated">最近更新</option>
                    <option value="popular">下载最多</option>
                  </select>
                </>
              ) : null}
            </div>
          </div>

          {libraryOnly && topicCounts.size ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="常用专题快捷筛选">
              {[topicAllOption, ...Array.from(topicCounts.keys()).slice(0, 7)].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setTopic(name); setMemberOnlyMaterial(null); }}
                  aria-pressed={topic === name}
                  className={`min-h-10 shrink-0 rounded-xl px-3.5 text-sm transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] ${topic === name ? "border border-brand-red bg-[#fff1f2] font-medium text-brand-red" : "border border-brand-line bg-white text-neutral-600 hover:border-[#d9a6ac] hover:bg-[#fafbfc]"}`}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {libraryOnly && !isLoading && downloadableVisibleMaterials.length ? (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-line bg-[#fafbfc] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <button type="button" onClick={toggleVisibleSelection} className="min-h-10 rounded-xl border border-[#dfe3e7] bg-white px-3.5 font-medium text-neutral-700 transition-[border-color,background-color,transform] duration-150 hover:border-[#cbd2d9] hover:bg-[#f8f9fa] active:scale-[0.98]">
                  {allVisibleSelected ? "取消全选" : "全选"}
                </button>
                <span className="text-neutral-500" aria-live="polite">已选 <b className="font-semibold text-brand-ink">{selectedSlugs.length}</b> 份</span>
                {selectedSlugs.length ? <button type="button" onClick={() => setSelectedSlugs([])} className="min-h-10 px-1 text-neutral-500 hover:text-brand-red">清空选择</button> : null}
              </div>
              <button type="button" onClick={batchDownload} disabled={!selectedSlugs.length || isBatchDownloading} className="min-h-11 shrink-0 rounded-xl bg-brand-red px-5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c9b8b9]">
                {isBatchDownloading ? "正在打包..." : `批量下载${selectedSlugs.length ? `（${selectedSlugs.length}）` : ""}`}
              </button>
            </div>
          ) : null}

          {memberOnlyMaterial ? (
            <div className="mt-5 rounded-3xl border-2 border-brand-red bg-[#fff8f8] px-6 py-10 text-center shadow-[0_12px_30px_rgba(166,62,71,0.06)]">
              <span className="inline-flex rounded-full bg-brand-red px-4 py-1.5 text-sm font-semibold text-white">会员专属资料</span>
              <h3 className="mx-auto mt-5 max-w-2xl text-xl font-semibold leading-8 text-brand-ink">{displayMaterialTitle(memberOnlyMaterial.title)}</h3>
              <p className="mt-4 text-base font-medium text-brand-red">开通会员后即可下载，会员有效期为一年。</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => setMemberOnlyMaterial(null)} className="rounded-xl border border-brand-line bg-white px-5 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-[#fafbfc]">返回资料列表</button>
                <Link href="/membership/payment" className="rounded-xl bg-brand-red px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98]">成为专属会员</Link>
              </div>
            </div>
          ) : (
          <>
          {message ? <div className="mt-4 rounded-xl border border-[#efd5d8] bg-[#fff8f8] px-4 py-3 text-sm text-[#7d4d53]">{message}</div> : null}
          {supportMaterial ? <SupportCard material={supportMaterial} onClose={() => setSupportMaterial(null)} /> : null}
          {isLoading ? (
            <div className="mt-4 space-y-3" role="status" aria-label="正在读取资料库">
              {[0, 1, 2].map((row) => (
                <div key={row} className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-brand-line">
                  <div className="h-3 w-28 rounded bg-[#e9edf0]" />
                  <div className="mt-3 h-5 w-2/3 rounded bg-[#e9edf0]" />
                  <div className="mt-3 h-3 w-full rounded bg-[#f1f3f5]" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-[#f1f3f5]" />
                </div>
              ))}
            </div>
          ) : (
          <div className="xuan-workspace mt-4 divide-y divide-[#e8ebee] overflow-hidden rounded-2xl">
            {visibleMaterials.map((material) => {
              const slug = getArticleSlug(material);
              const isFavorite = favoriteSlugs.includes(slug);
              const isSelected = selectedSlugs.includes(slug);
              return (
                <article key={material.id} className={`grid gap-4 p-5 transition-colors duration-150 md:grid-cols-[1fr_128px] md:items-center ${isSelected ? "bg-[#fff4f5]" : "hover:bg-[#fafbfc]"}`}>
                  <div className="flex min-w-0 items-start gap-4">
                    {libraryOnly ? (
                      <label className={`mt-3 flex h-5 w-5 shrink-0 items-center justify-center ${material.file_url ? "cursor-pointer" : "cursor-not-allowed opacity-35"}`}>
                        <input type="checkbox" checked={isSelected} disabled={!material.file_url} onChange={() => toggleSelection(material)} aria-label={`选择${displayMaterialTitle(material.title)}`} className="h-4 w-4 rounded border-[#c7cdd3] accent-[#a63e47] focus:ring-2 focus:ring-[#f5d8db]" />
                      </label>
                    ) : null}
                    <FileTypeIcon fileType={material.file_type} />
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{material.topic || material.category}</span><span>·</span><span>{material.file_type}</span>
                      {material.member_only ? <span className="rounded-full bg-[#fff1f2] px-2 py-0.5 text-[#8d5057]">会员专属</span> : null}
                    </div>
                    <Link href={`/materials/${slug}`} title={material.title} className="material-title mt-2 block text-lg font-semibold leading-7 text-brand-ink transition-colors duration-150 hover:text-brand-red"><span className="xuan-hover-highlight">{displayMaterialTitle(material.title)}</span></Link>
                    {meaningful(material.scenarios || material.description || material.summary) ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">适用场景：{material.scenarios || material.description || material.summary}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                      <span>更新 {formatDisplayDay(material.updated_at)}</span>
                      {material.downloadable || material.file_url ? null : <span>仅查看</span>}
                      {hasFillingGuide(material) ? <span className="text-[#7d6268]">含填写说明</span> : null}
                    </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button type="button" onClick={() => onToggleFavorite(material)} aria-label={isFavorite ? "取消收藏" : "收藏资料"} className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-line text-lg text-[#a7793b] transition-[border-color,background-color,transform] duration-150 ease-out hover:border-[#e2c693] hover:bg-[#fffaf0] active:scale-[0.97]">{isFavorite ? "★" : "☆"}</button>
                    <button type="button" onClick={() => download(material)} className="min-h-11 rounded-xl border border-[#e8cfd2] bg-[#fff1f2] px-4 py-2.5 text-sm font-medium text-brand-red transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-red hover:text-white active:scale-[0.97]">下载</button>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          {libraryOnly && !isLoading && totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-center gap-2" aria-label="资料分页">
              <button type="button" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1} className="min-h-11 rounded-xl border border-brand-line bg-white px-4 text-sm text-neutral-600 transition-[background-color,transform] duration-150 ease-out hover:bg-[#f1f3f5] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40">上一页</button>
              <span className="px-2 text-sm text-neutral-600" aria-live="polite">第 {currentPage} / {totalPages} 页</span>
              <button type="button" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages} className="min-h-11 rounded-xl border border-brand-line bg-white px-4 text-sm text-neutral-600 transition-[background-color,transform] duration-150 ease-out hover:bg-[#f1f3f5] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40">下一页</button>
            </nav>
          ) : null}
          {!isLoading && !filteredMaterials.length ? <div className="xuan-quiet-card mt-4 rounded-2xl p-10 text-center text-sm text-neutral-500">没有找到匹配资料，请更换关键词或专题。</div> : null}
          {!libraryOnly && !isLoading && filteredMaterials.length ? (
            <p className="mt-4 text-center text-xs text-neutral-400">
              首页仅展示最新 3 份，全部资料请前往
              <Link href="/library" className="ml-1 text-[#9a4650] hover:underline">资料库</Link>
              。
            </p>
          ) : null}
          </>
          )}
        </section>


        {!libraryOnly ? <QuestionEntry /> : null}
      </div>}
    </div>
  );
}

export function QuestionEntry() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [publicQuestions, setPublicQuestions] = useState<Array<{ id: string; question: string }>>([]);
  const [activeQuestion, setActiveQuestion] = useState(0);

  useEffect(() => {
    fetch("/api/questions", { cache: "no-store" })
      .then((response) => response.json())
      .then((rows) => setPublicQuestions(Array.isArray(rows) ? rows : []))
      .catch(() => setPublicQuestions([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") || "").trim();
    if (!question) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "提交失败，请稍后重试。");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      {submitted ? <section id="submit-question" className="scroll-mt-28 rounded-3xl border border-[#efd5d8] bg-[#fff5f5] p-8 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-red text-lg text-white">✓</div><h2 className="mt-3 text-xl font-semibold text-brand-ink">问题提交成功</h2><p className="mt-2 text-sm text-neutral-500">我们会整理高频需求，持续补充资料。</p></section> : <section id="submit-question" className="scroll-mt-28 rounded-3xl border border-brand-line bg-[#fafbfc] p-5 md:p-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <textarea id="question-input" name="question" required maxLength={500} aria-label="输入问题" placeholder="输入你遇到的问题或想找的资料" className="min-h-20 min-w-0 flex-1 resize-none rounded-xl border border-brand-line bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-neutral-400 focus:border-[#d9a6ac] focus:ring-2 focus:ring-[#f5d8db] sm:min-h-16" />
          <button type="submit" disabled={submitting} className="h-12 shrink-0 rounded-xl bg-brand-red px-5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:bg-brand-darkRed active:scale-[0.98] disabled:opacity-50">{submitting ? "提交中" : "提交问题"}</button>
        </form>
        {error ? <p className="mt-3 text-sm text-brand-red">{error}</p> : null}
      </section>}
      {publicQuestions.length ? <section className="overflow-hidden rounded-3xl border border-brand-line bg-white p-5 md:p-6">
        <h2 className="text-xl font-semibold text-brand-ink">答疑区</h2>
        <Link href={`/questions/${publicQuestions[activeQuestion]?.id}`} className="mt-4 inline-flex max-w-full items-center rounded-2xl bg-[#f1f3f5] px-5 py-4 transition-colors duration-150 hover:bg-[#e9edf0]"><h3 className="text-sm font-semibold leading-6 text-brand-ink">问：{publicQuestions[activeQuestion]?.question}</h3></Link>
        {publicQuestions.length > 1 ? <div className="mt-4 flex gap-2">{publicQuestions.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveQuestion(index)} aria-label={`查看第${index + 1}个问题`} className={`h-1.5 rounded-full transition-[width,background-color] duration-150 ${index === activeQuestion ? "w-8 bg-brand-red" : "w-3 bg-[#a63e47]/20"}`} />)}</div> : null}
      </section> : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-brand-ink">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-neutral-500">{subtitle}</p> : null}
    </div>
  );
}

function popularity(material: Material) {
  return Number(material.download_count || 0) + Number(material.favorite_count || 0) * 2;
}

function dateValue(value?: string) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function meaningful(value?: string) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "待补充" && text !== "无");
}

function hasFillingGuide(material: Material) {
  return meaningful(material.note) || meaningful(material.downloadNote) || meaningful(material.introduction);
}

function displayMaterialTitle(title: string) {
  return title.replace(/^【小宣资料库】\s*/, "").trim();
}
