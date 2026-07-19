import type { Metadata } from "next";
import Link from "next/link";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import { getWorkTopic, workTopics, type WorkTopic } from "@/lib/work-platform";
import { formatDisplayDay } from "@/lib/format-date";
import type { Material } from "@/lib/types";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { topic: string } }): Metadata {
  const topic = getWorkTopic(params.topic);
  const name = topic?.name || decodeURIComponent(params.topic);
  const description = topic?.summary || `查看${name}的工作流程、制度依据、清单、常见问题和模板资料。`;
  return { title: `${name}专题｜宣知党建`, description };
}

function genericTopic(value: string): WorkTopic {
  return { slug: value, name: value, aliases: [value], summary: `围绕${value}整理流程、依据和现有资料。`, scenario: `适用于基层党组织开展${value}相关工作。`, steps: ["明确工作要求", "准备相关材料", "按程序组织实施", "形成记录并归档"], checklist: ["核对上级要求", "明确时间和人员", "准备工作材料", "完成过程记录", "整理归档"], requirements: ["依据现行制度执行", "程序和材料同步留痕"], legalBasis: ["相关制度依据待结合现有内容持续补充"], faqs: [] };
}

function matchesTopic(material: Material, topic: WorkTopic) {
  const haystack = [material.title, material.description, material.summary, material.topic, material.category, material.stage, ...(material.tags || [])].join(" ").toLowerCase();
  return topic.aliases.some((alias) => haystack.includes(alias.toLowerCase()));
}

export default async function TopicPage({ params }: { params: { topic: string } }) {
  const decoded = decodeURIComponent(params.topic);
  const topic = getWorkTopic(decoded) || genericTopic(decoded);
  const allMaterials = (await listContentUnits()).map(contentUnitToMaterial);
  const materials = allMaterials.filter((item) => matchesTopic(item, topic));
  const downloadable = materials.filter((item) => item.downloadable || item.file_url).slice(0, 6);
  const articles = materials.filter((item) => !(item.downloadable || item.file_url)).slice(0, 5);
  const relatedTopics = workTopics.filter((item) => item.slug !== topic.slug).slice(0, 4);

  return <main>
    <section className="border-b border-[#e8e5e0] bg-white"><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><Link href="/work-navigation" className="text-sm text-[#8d2f32]">← 返回工作导航</Link><div className="mt-7 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-end"><div><p className="text-sm font-medium text-[#98373a]">工作专题</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#292d2b] md:text-5xl">{topic.name}</h1><p className="mt-5 max-w-3xl text-base leading-8 text-neutral-600">{topic.scenario}</p></div><div className="rounded-2xl bg-[#f3f2ef] p-5"><p className="text-xs font-medium text-neutral-500">这份指南帮助你</p><p className="mt-2 text-sm leading-7 text-neutral-700">{topic.summary}</p></div></div></div></section>

    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <section><SectionHeading index="01" title="工作流程图" subtitle="先看完整路径，再进入每个具体环节。"/><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{topic.steps.map((step, index) => <div key={step} className="relative rounded-2xl border border-[#e3e0db] bg-white p-5"><span className="text-xs font-semibold text-[#a33a3d]">步骤 {index + 1}</span><p className="mt-2 font-medium text-[#292d2b]">{step}</p>{index < topic.steps.length - 1 ? <span className="absolute -right-3 top-1/2 z-10 hidden text-neutral-300 lg:block">→</span> : null}</div>)}</div></section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"><div className="rounded-2xl border border-[#e3e0db] bg-white p-6 md:p-8"><SectionHeading index="02" title="工作清单 Checklist" subtitle="当前用于逐项核对展示，不保存个人完成状态。"/><ul className="mt-6 space-y-3">{topic.checklist.map((item) => <li key={item} className="flex gap-3 rounded-xl bg-[#f7f6f3] px-4 py-3 text-sm text-neutral-700"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#b6b2ab] bg-white text-[10px] text-transparent">✓</span><span>{item}</span></li>)}</ul></div><div className="space-y-5"><InfoBlock index="03" title="制度依据" items={topic.legalBasis}/><InfoBlock index="04" title="核心要求" items={topic.requirements}/></div></section>

      <section className="mt-14"><SectionHeading index="05" title="常见问题" subtitle="优先回答办理中容易拿不准的问题。"/><div className="mt-6 space-y-3">{topic.faqs.map((faq) => <details key={faq.question} className="group rounded-2xl border border-[#e3e0db] bg-white p-5"><summary className="cursor-pointer list-none font-medium text-[#292d2b]">{faq.question}<span className="float-right text-neutral-400 group-open:rotate-45">＋</span></summary><p className="mt-4 text-sm leading-7 text-neutral-600">{faq.answer}</p></details>)}{!topic.faqs.length ? <EmptyNote text="常见问题正在结合现有内容整理。"/> : null}</div></section>

      <section className="mt-14"><SectionHeading index="06" title="模板资料下载" subtitle="显示适用场景、格式、时间和专业版状态，不只展示文件名。"/><div className="mt-6 grid gap-4 md:grid-cols-2">{downloadable.map((item) => <MaterialCard key={item.id} item={item}/>)}</div>{!downloadable.length ? <div className="mt-6"><EmptyNote text="该专题暂无可下载资料，知识指南仍可免费查看。"/></div> : null}</section>

      <section className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div><SectionHeading index="07" title="相关文章" subtitle="用于补充制度解读和实务说明。"/><div className="mt-6 space-y-3">{articles.map((item) => <Link key={item.id} href={`/materials/${item.slug || item.id}`} className="block rounded-xl border border-[#e3e0db] bg-white px-5 py-4 font-medium text-[#292d2b] hover:text-[#8d2f32]">{item.title}</Link>)}{!articles.length ? <EmptyNote text="暂未关联独立文章。"/> : null}</div></div><div><SectionHeading index="08" title="相关知识" subtitle="继续查看相邻工作事项。"/><div className="mt-6 grid gap-3 sm:grid-cols-2">{relatedTopics.map((item) => <Link key={item.slug} href={`/topics/${item.slug}`} className="rounded-xl border border-[#e3e0db] bg-white p-4"><span className="font-medium text-[#292d2b]">{item.name}</span><span className="mt-2 block text-xs text-neutral-500">查看工作指南 →</span></Link>)}</div></div></section>

      <section className="mt-14 rounded-2xl bg-[#303633] p-7 text-white md:flex md:items-center md:justify-between md:p-9"><div><p className="text-sm text-white/60">AI提问入口 · 持续完善中</p><h2 className="mt-2 text-2xl font-semibold">还有拿不准的制度或流程问题？</h2><p className="mt-3 text-sm leading-7 text-white/70">先查看本页依据和清单；后续可在宣知党建助手中继续提问。</p></div><Link href={`/ai-assistant?topic=${encodeURIComponent(topic.name)}`} className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#303633] md:mt-0">向助手提问</Link></section>
    </div>
  </main>;
}

function SectionHeading({ index, title, subtitle }: { index: string; title: string; subtitle: string }) { return <div><p className="text-xs font-semibold text-[#a33a3d]">{index}</p><h2 className="mt-2 text-2xl font-semibold text-[#292d2b]">{title}</h2><p className="mt-2 text-sm leading-6 text-neutral-600">{subtitle}</p></div>; }
function InfoBlock({ index, title, items }: { index: string; title: string; items: string[] }) { return <div className="rounded-2xl border border-[#e3e0db] bg-white p-6"><SectionHeading index={index} title={title} subtitle=""/><ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">{items.map((item) => <li key={item} className="flex gap-3"><span className="text-[#a33a3d]">—</span><span>{item}</span></li>)}</ul></div>; }
function EmptyNote({ text }: { text: string }) { return <p className="rounded-2xl border border-dashed border-[#d8d4ce] bg-[#f7f6f3] p-5 text-sm leading-6 text-neutral-500">{text}</p>; }
function MaterialCard({ item }: { item: Material }) { return <article className="rounded-2xl border border-[#e3e0db] bg-white p-5"><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#eef1ee] px-3 py-1 text-[#50675c]">{item.file_type}</span><span className="rounded-full bg-[#f4f2ee] px-3 py-1 text-neutral-600">{item.member_only ? "宣知专业版" : "免费"}</span><span className="rounded-full bg-[#f4f2ee] px-3 py-1 text-neutral-600">{item.topic || item.category}</span></div><h3 className="mt-4 text-lg font-semibold text-[#292d2b]">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-600">{item.description || "适用于该专题相关工作场景。"}</p><div className="mt-4 flex items-center justify-between border-t border-[#ece9e4] pt-4 text-xs text-neutral-500"><span>更新 {formatDisplayDay(item.updated_at)}</span><Link href={`/materials/${item.slug || item.id}`} className="font-medium text-[#8d2f32]">查看资料 →</Link></div></article>; }
