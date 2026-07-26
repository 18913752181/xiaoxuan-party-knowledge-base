"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadMaterialFile } from "@/lib/download-file";
import { getArticleSlug, listMyFavorites, toggleFavorite } from "@/lib/favorites";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";

const topicAllOption = "全部专题";
const preferredTopics = ["发展党员", "主题党日", "换届选举", "三会一课", "组织生活会", "支部建设"];

export function ResourceLibrary({ initialTopic = "", libraryOnly = false }: { initialTopic?: string; libraryOnly?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialKeyword = searchParams.get("q") || "";
  const [materials, setMaterials] = useState<Material[]>([]);
  const [keyword, setKeyword] = useState(initialKeyword);
  const [submittedKeyword, setSubmittedKeyword] = useState(initialKeyword);
  const [topic, setTopic] = useState(initialTopic || searchParams.get("topic") || topicAllOption);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [memberOnlyMaterial, setMemberOnlyMaterial] = useState<Material | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    fetch("/api/content-units", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("资料读取失败");
        return response.json();
      })
      .then((rows) => setMaterials(Array.isArray(rows) ? rows : []))
      .catch((error) => setMessage(`资料读取失败：${error.message}`))
      .finally(() => setIsLoading(false));

    listMyFavorites().then(({ rows, error }) => {
      if (!error) setFavoriteSlugs(rows.map((row) => row.article_slug));
    });
  }, []);

  useEffect(() => setTopic(initialTopic || searchParams.get("topic") || topicAllOption), [initialTopic, searchParams]);

  const sortedMaterials = useMemo(
    () => [...materials].sort((a, b) => dateValue(b.updated_at || b.uploaded_at) - dateValue(a.updated_at || a.uploaded_at)),
    [materials]
  );

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    materials.forEach((item) => {
      const name = item.topic || item.category;
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return counts;
  }, [materials]);

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

  const slides = useMemo(() => {
    const newest = sortedMaterials[0];
    const popular = [...materials].sort((a, b) => popularity(b) - popularity(a)).find((item) => getArticleSlug(item) !== getArticleSlug(newest));
    const policy = sortedMaterials.find((item) => `${item.topic || ""}${item.category || ""}${item.file_type || ""}`.includes("制度"));
    const primary = [
      newest && { label: "本周新资料", material: newest },
      popular && { label: "热门专题", material: popular },
      policy && { label: "最新制度", material: policy }
    ].filter(Boolean) as Array<{ label: string; material: Material }>;
    const unique = primary.filter((item, index) => primary.findIndex((candidate) => getArticleSlug(candidate.material) === getArticleSlug(item.material)) === index);
    const fallbackLabels = ["本周新资料", "热门专题", "最新制度"];
    for (const material of sortedMaterials) {
      if (unique.length >= 3) break;
      if (!unique.some((item) => getArticleSlug(item.material) === getArticleSlug(material))) unique.push({ label: fallbackLabels[unique.length], material });
    }
    return unique.slice(0, 3);
  }, [materials, sortedMaterials]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const filteredMaterials = useMemo(() => {
    const query = submittedKeyword.trim().toLowerCase();
    return sortedMaterials.filter((material) => {
      const materialTopic = material.topic || material.category;
      const searchableText = [material.title, material.description, material.summary, material.category, materialTopic, material.stage, material.file_type, material.file_name, ...(material.tags || [])]
        .join(" ")
        .toLowerCase();
      return (topic === topicAllOption || materialTopic === topic) && (!query || searchableText.includes(query));
    });
  }, [submittedKeyword, sortedMaterials, topic]);

  const searchResults = useMemo(() => {
    const query = submittedKeyword.trim().toLowerCase();
    if (!query) return [];
    return sortedMaterials
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
  }, [submittedKeyword, sortedMaterials]);

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
    if (material.member_only) {
      setMemberOnlyMaterial(material);
      setMessage("");
      return;
    }
    setMessage("正在准备下载...");
    const result = await downloadMaterialFile(material);
    if (!result.ok) {
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) window.setTimeout(() => router.push("/login"), 800);
      return;
    }
    updateMaterialCount(getArticleSlug(material), "download_count", material.download_count + 1);
    setMessage("文件下载已开始。");
  }

  function chooseTopic(name: string) {
    setTopic(name);
    setMemberOnlyMaterial(null);
    document.querySelector("#latest-materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="pb-20 lg:pb-0">
      <section className="border-b border-[#e9e6e1] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-10">
          <p className="text-sm font-medium text-[#9a4650]">{libraryOnly ? "全部资料" : "小宣资料库"}</p>
          <form onSubmit={submitSearch} className="mt-4 flex items-center rounded-2xl bg-[#f1f0ed] pl-4 shadow-inner ring-1 ring-[#ebe5dc] focus-within:ring-[#b77b80]">
            <span className="mr-3 text-xl text-neutral-400" aria-hidden="true">⌕</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索主题党日、组织生活会、发展党员、党支部换届……" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-neutral-400" />
            {submittedKeyword ? <button type="button" onClick={clearSearch} className="h-14 shrink-0 px-3 text-sm text-neutral-400">清除</button> : null}
            <button type="submit" className="m-1.5 h-11 shrink-0 rounded-xl bg-[#9a4650] px-5 text-sm font-medium text-white transition hover:bg-[#7d3540]">搜索</button>
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
                        className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-[#faf6f2]"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-brand-ink">{material.title}</span>
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

      {showSearchMode ? null : <main className="mx-auto max-w-6xl space-y-10 px-5 py-7 lg:px-8 lg:py-10">
        {!libraryOnly && slides.length ? <FeaturedCarousel slides={slides} active={Math.min(activeSlide, slides.length - 1)} onChange={setActiveSlide} /> : null}

        {!libraryOnly && frequentTopics.length ? (
          <section>
            <SectionHeader title="高频工作" />
            <div className="mt-4 grid grid-cols-3 gap-3 md:grid-cols-6">
              {frequentTopics.map(([name, count], index) => (
                <button key={name} type="button" onClick={() => chooseTopic(name)} className="group rounded-2xl bg-white px-2 py-4 text-center shadow-sm ring-1 ring-[#ebe5dc] transition hover:-translate-y-0.5 hover:ring-[#caa8aa]">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4e9e8] text-base font-semibold text-[#9a4650]">{String(index + 1).padStart(2, "0")}</span>
                  <span className="mt-2 block text-sm font-medium text-brand-ink">{name}</span>
                  <span className="mt-1 block text-[11px] text-neutral-400">{count} 份资料</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section id="latest-materials" className="scroll-mt-28">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeader title={topic === topicAllOption ? (libraryOnly ? "全部资料" : "最新资料") : "专题资料"} subtitle={libraryOnly ? `共 ${filteredMaterials.length} 份` : undefined} />
            <select value={topic} onChange={(event) => { setTopic(event.target.value); setMemberOnlyMaterial(null); }} className="h-11 rounded-xl border border-[#e4ded5] bg-white px-4 text-sm text-neutral-600 outline-none">
              <option value={topicAllOption}>{topicAllOption}</option>
              {Array.from(topicCounts.keys()).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {memberOnlyMaterial ? (
            <div className="mt-5 rounded-3xl border-2 border-[#9a4650] bg-[#fff7f5] px-6 py-10 text-center shadow-sm">
              <span className="inline-flex rounded-full bg-[#9a4650] px-4 py-1.5 text-sm font-semibold text-white">会员专属资料</span>
              <h3 className="mx-auto mt-5 max-w-2xl text-xl font-semibold leading-8 text-brand-ink">{memberOnlyMaterial.title}</h3>
              <p className="mt-4 text-base font-medium text-[#9a4650]">该资料为会员专属，后续开放。</p>
              <button type="button" onClick={() => setMemberOnlyMaterial(null)} className="mt-6 rounded-xl border border-[#d8c7c1] bg-white px-5 py-2.5 text-sm text-neutral-600">返回资料列表</button>
            </div>
          ) : (
          <>
          {message ? <div className="mt-4 rounded-xl border border-[#d9cab1] bg-[#fffaf1] px-4 py-3 text-sm text-[#7a633f]">{message}</div> : null}
          {isLoading ? (
            <div className="mt-4 rounded-2xl bg-white p-10 text-center text-sm text-neutral-500 ring-1 ring-[#ebe5dc]">正在读取资料库…</div>
          ) : (
          <div className="mt-4 divide-y divide-[#eeeae4] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#ebe5dc]">
            {filteredMaterials.slice(0, libraryOnly ? undefined : 3).map((material) => {
              const slug = getArticleSlug(material);
              const isFavorite = favoriteSlugs.includes(slug);
              return (
                <article key={material.id} className="grid gap-4 p-5 transition hover:bg-[#fcfaf7] md:grid-cols-[1fr_128px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{material.topic || material.category}</span><span>·</span><span>{material.file_type}</span>
                      {material.member_only ? <span className="rounded-full bg-[#f5ece4] px-2 py-0.5 text-[#8a6b50]">会员专属</span> : null}
                    </div>
                    <Link href={`/materials/${slug}`} className="mt-2 block text-lg font-semibold leading-7 text-brand-ink hover:text-[#8d2f32]">{material.title}</Link>
                    {meaningful(material.scenarios || material.description || material.summary) ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">适用场景：{material.scenarios || material.description || material.summary}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                      <span>更新 {formatDisplayDay(material.updated_at)}</span>
                      <span>{material.downloadable || material.file_url ? "可下载" : "仅查看"}</span>
                      <span>{hasFillingGuide(material) ? "有填写说明" : "暂无填写说明"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button type="button" onClick={() => onToggleFavorite(material)} aria-label={isFavorite ? "取消收藏" : "收藏资料"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ebe5dc] text-lg text-[#b1843e]">{isFavorite ? "★" : "☆"}</button>
                    <button type="button" onClick={() => download(material)} className="rounded-xl bg-[#9a4650] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#7d3540]">下载</button>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          {!isLoading && !filteredMaterials.length ? <div className="mt-4 rounded-2xl bg-white p-10 text-center text-sm text-neutral-500 ring-1 ring-[#ebe5dc]">没有找到匹配资料，请更换关键词或专题。</div> : null}
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
      </main>}
    </div>
  );
}

function FeaturedCarousel({ slides, active, onChange }: { slides: Array<{ label: string; material: Material }>; active: number; onChange: (index: number) => void }) {
  const current = slides[active];
  const slug = getArticleSlug(current.material);
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#e1d4cc] bg-[#eee4de] p-5 text-brand-ink shadow-sm md:p-7">
      <div className="absolute -right-14 -top-20 h-48 w-48 rounded-full bg-[#c98e94]/25 blur-2xl" />
      <div className="absolute bottom-0 right-16 h-24 w-40 rounded-full bg-white/55 blur-2xl" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-medium tracking-[0.18em] text-[#9a4650]">{current.label}</p>
        <h2 className="mt-3 line-clamp-2 text-xl font-semibold leading-snug md:text-2xl">{current.material.title}</h2>
        {meaningful(current.material.description || current.material.summary) ? <p className="mt-2 line-clamp-1 text-sm leading-6 text-neutral-600">{current.material.description || current.material.summary}</p> : null}
        <Link href={`/materials/${slug}`} className="mt-4 inline-flex rounded-xl border border-[#cbb8ad] bg-white/45 px-4 py-2 text-sm text-[#7d3540] transition hover:bg-white/70">查看资料</Link>
      </div>
      {slides.length > 1 ? <div className="relative mt-5 flex gap-2">{slides.map((slide, index) => <button key={`${slide.label}-${getArticleSlug(slide.material)}`} type="button" onClick={() => onChange(index)} aria-label={`查看第${index + 1}张`} className={`h-1.5 rounded-full transition-all ${active === index ? "w-8 bg-[#9a4650]" : "w-3 bg-[#9a4650]/25"}`} />)}</div> : null}
    </section>
  );
}

function QuestionEntry() {
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

  useEffect(() => {
    if (publicQuestions.length < 2) return;
    const timer = window.setInterval(() => setActiveQuestion((current) => (current + 1) % publicQuestions.length), 4500);
    return () => window.clearInterval(timer);
  }, [publicQuestions.length]);

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
      {submitted ? <section id="submit-question" className="scroll-mt-28 rounded-3xl border border-[#d9cec3] bg-[#f0e7e1] p-8 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#9a4650] text-lg text-white">✓</div><h2 className="mt-3 text-xl font-semibold text-brand-ink">问题提交成功</h2><p className="mt-2 text-sm text-neutral-500">我们会整理高频需求，持续补充资料。</p></section> : <section id="submit-question" className="scroll-mt-28 rounded-3xl border border-[#e3d8cf] bg-[#f5eee8] p-5 md:p-6">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <textarea id="question-input" name="question" required maxLength={500} aria-label="输入问题" placeholder="输入你遇到的问题或想找的资料" className="min-h-20 min-w-0 flex-1 resize-none rounded-xl border border-[#ddcec4] bg-white px-4 py-3 text-sm leading-6 outline-none placeholder:text-neutral-400 sm:min-h-16" />
          <button type="submit" disabled={submitting} className="h-12 shrink-0 rounded-xl bg-[#9a4650] px-5 text-sm font-medium text-white disabled:opacity-50">{submitting ? "提交中" : "提交问题"}</button>
        </form>
        {error ? <p className="mt-3 text-sm text-[#9a4650]">{error}</p> : null}
      </section>}
      {publicQuestions.length ? <section className="overflow-hidden rounded-3xl border border-[#e3d8cf] bg-white p-5 md:p-6">
        <h2 className="text-xl font-semibold text-brand-ink">答疑区</h2>
        <Link href={`/questions/${publicQuestions[activeQuestion]?.id}`} className="mt-4 inline-flex max-w-full items-center rounded-2xl bg-[#f7f2ed] px-5 py-4 transition hover:bg-[#f2e9e3]"><h3 className="text-sm font-semibold leading-6 text-[#3f4943]">问：{publicQuestions[activeQuestion]?.question}</h3></Link>
        {publicQuestions.length > 1 ? <div className="mt-4 flex gap-2">{publicQuestions.map((item, index) => <button key={item.id} type="button" onClick={() => setActiveQuestion(index)} aria-label={`查看第${index + 1}个问题`} className={`h-1.5 rounded-full transition-all ${index === activeQuestion ? "w-8 bg-[#9a4650]" : "w-3 bg-[#9a4650]/20"}`} />)}</div> : null}
      </section> : null}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div><h2 className="text-2xl font-semibold text-brand-ink">{title}</h2>{subtitle ? <p className="mt-1 text-sm text-neutral-400">{subtitle}</p> : null}</div>;
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
