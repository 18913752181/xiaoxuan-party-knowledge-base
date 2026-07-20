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

export function ResourceLibrary({ initialTopic = "" }: { initialTopic?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  const [topic, setTopic] = useState(initialTopic || searchParams.get("topic") || topicAllOption);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);

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
    const popular = [...materials].sort((a, b) => popularity(b) - popularity(a))[0];
    const policy = sortedMaterials.find((item) => `${item.topic || ""}${item.category || ""}${item.file_type || ""}`.includes("制度"));
    const candidates = [
      newest && { label: "本周新资料", material: newest },
      popular && { label: "热门专题", material: popular },
      policy && { label: "最新制度", material: policy }
    ].filter(Boolean) as Array<{ label: string; material: Material }>;
    return candidates.filter((item, index) => candidates.findIndex((candidate) => getArticleSlug(candidate.material) === getArticleSlug(item.material)) === index);
  }, [materials, sortedMaterials]);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const filteredMaterials = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return sortedMaterials.filter((material) => {
      const materialTopic = material.topic || material.category;
      const searchableText = [material.title, material.description, material.summary, material.category, materialTopic, material.stage, material.file_type, material.file_name, ...(material.tags || [])]
        .join(" ")
        .toLowerCase();
      return (topic === topicAllOption || materialTopic === topic) && (!query || searchableText.includes(query));
    });
  }, [keyword, sortedMaterials, topic]);

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
      setMessage(result.error || "下载失败。");
      if (result.needsLogin) window.setTimeout(() => router.push("/login"), 800);
      return;
    }
    updateMaterialCount(getArticleSlug(material), "download_count", material.download_count + 1);
    setMessage("文件下载已开始。");
  }

  function chooseTopic(name: string) {
    setTopic(name);
    document.querySelector("#latest-materials")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="pb-20 lg:pb-0">
      <section className="border-b border-[#e9e6e1] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-10">
          <p className="text-sm font-medium text-[#9a4650]">小宣资料库</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-ink md:text-4xl">需要哪份党建资料？</h1>
          <p className="mt-3 text-sm leading-7 text-neutral-500">搜索主题党日、组织生活会、发展党员、党支部换届……</p>
          <div className="mt-5 flex items-center rounded-2xl bg-[#f1f0ed] px-4 shadow-inner ring-1 ring-[#ebe5dc] focus-within:ring-[#b77b80]">
            <span className="mr-3 text-xl text-neutral-400" aria-hidden="true">⌕</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入资料名称或工作主题" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-brand-ink outline-none placeholder:text-neutral-400" />
            {keyword ? <button type="button" onClick={() => setKeyword("")} className="px-2 text-sm text-neutral-400">清除</button> : null}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-10 px-5 py-7 lg:px-8 lg:py-10">
        {slides.length ? <FeaturedCarousel slides={slides} active={Math.min(activeSlide, slides.length - 1)} onChange={setActiveSlide} /> : null}

        {frequentTopics.length ? (
          <section>
            <SectionHeader title="高频工作" subtitle="只展示已有较完整资料的专题" />
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
            <SectionHeader title={topic === topicAllOption ? "最新资料" : topic} subtitle="最近更新的真实内容" />
            <select value={topic} onChange={(event) => setTopic(event.target.value)} className="h-11 rounded-xl border border-[#e4ded5] bg-white px-4 text-sm text-neutral-600 outline-none">
              <option value={topicAllOption}>{topicAllOption}</option>
              {Array.from(topicCounts.keys()).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {message ? <div className="mt-4 rounded-xl border border-[#d9cab1] bg-[#fffaf1] px-4 py-3 text-sm text-[#7a633f]">{message}</div> : null}
          <div className="mt-4 divide-y divide-[#eeeae4] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#ebe5dc]">
            {filteredMaterials.slice(0, 12).map((material) => {
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
          {!filteredMaterials.length ? <div className="mt-4 rounded-2xl bg-white p-10 text-center text-sm text-neutral-500 ring-1 ring-[#ebe5dc]">没有找到匹配资料，请更换关键词或专题。</div> : null}
        </section>

        <QuestionEntry />
      </main>
    </div>
  );
}

function FeaturedCarousel({ slides, active, onChange }: { slides: Array<{ label: string; material: Material }>; active: number; onChange: (index: number) => void }) {
  const current = slides[active];
  const slug = getArticleSlug(current.material);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#303a36] p-6 text-white shadow-sm md:p-9">
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#9a4650]/25 blur-2xl" />
      <div className="relative max-w-3xl">
        <p className="text-xs font-medium tracking-[0.18em] text-white/60">{current.label}</p>
        <h2 className="mt-4 text-2xl font-semibold leading-tight md:text-3xl">{current.material.title}</h2>
        {meaningful(current.material.description || current.material.summary) ? <p className="mt-3 line-clamp-2 text-sm leading-7 text-white/70">{current.material.description || current.material.summary}</p> : null}
        <Link href={`/materials/${slug}`} className="mt-6 inline-flex rounded-xl border border-white/25 px-4 py-2 text-sm text-white transition hover:bg-white/10">查看资料</Link>
      </div>
      {slides.length > 1 ? <div className="relative mt-7 flex gap-2">{slides.map((slide, index) => <button key={`${slide.label}-${getArticleSlug(slide.material)}`} type="button" onClick={() => onChange(index)} aria-label={`查看第${index + 1}张`} className={`h-1.5 rounded-full transition-all ${active === index ? "w-8 bg-white" : "w-3 bg-white/35"}`} />)}</div> : null}
    </section>
  );
}

function QuestionEntry() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = [
      `遇到的工作：${form.get("work") || ""}`,
      `想找的资料：${form.get("material") || ""}`,
      `所属行业：${form.get("industry") || ""}`,
      `是否希望公开回答：${form.get("publicAnswer") || "否"}`
    ].join("\n");
    window.location.href = `mailto:1743398170@qq.com?subject=${encodeURIComponent("宣知资料需求提交")}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
  }

  return (
    <section id="submit-question" className="scroll-mt-28 rounded-3xl border border-[#e3d8cf] bg-[#f5eee8] p-6 md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-medium text-[#9a4650]">资料需求</p><h2 className="mt-2 text-2xl font-semibold text-brand-ink">没找到需要的资料？</h2><p className="mt-2 text-sm leading-6 text-neutral-500">提交你的问题，我们会从高频需求中整理新模板、新问答和新专题。</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="shrink-0 rounded-xl bg-[#9a4650] px-5 py-3 text-sm font-medium text-white">{open ? "收起" : "提交问题"}</button>
      </div>
      {open ? (
        <form onSubmit={submit} className="mt-6 grid gap-4 border-t border-[#dfd0c5] pt-6 md:grid-cols-2">
          <QuestionField name="work" label="遇到什么工作" placeholder="例如：准备召开组织生活会" required />
          <QuestionField name="material" label="想找什么资料" placeholder="例如：会议通知和记录模板" required />
          <QuestionField name="industry" label="所属行业" placeholder="例如：国企、学校、社区" />
          <label className="text-sm text-neutral-600">是否希望公开回答<select name="publicAnswer" className="mt-2 h-12 w-full rounded-xl border border-[#ddcec4] bg-white px-4 outline-none"><option>否</option><option>是</option></select></label>
          <div className="md:col-span-2"><button type="submit" className="rounded-xl bg-[#303a36] px-5 py-3 text-sm font-medium text-white">发送问题</button>{submitted ? <span className="ml-3 text-sm text-neutral-500">已打开邮件应用，请确认发送。</span> : null}</div>
        </form>
      ) : null}
    </section>
  );
}

function QuestionField({ name, label, placeholder, required = false }: { name: string; label: string; placeholder: string; required?: boolean }) {
  return <label className="text-sm text-neutral-600">{label}<input name={name} required={required} placeholder={placeholder} className="mt-2 h-12 w-full rounded-xl border border-[#ddcec4] bg-white px-4 outline-none placeholder:text-neutral-400" /></label>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-2xl font-semibold text-brand-ink">{title}</h2><p className="mt-1 text-sm text-neutral-400">{subtitle}</p></div>;
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
