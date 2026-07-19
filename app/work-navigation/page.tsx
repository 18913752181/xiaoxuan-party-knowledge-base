import type { Metadata } from "next";
import Link from "next/link";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import type { Material } from "@/lib/types";
import { findWorkTopics } from "@/lib/work-platform";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "工作导航｜宣知党建",
  description: "按党建工作事项查找专题、办理流程、制度依据、常见问题和可下载资料。"
};

export default async function WorkNavigationPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = (searchParams.q || "").trim();
  const matchedTopics = findWorkTopics(query);
  const materials = (await listContentUnits()).map(contentUnitToMaterial);
  const matchedMaterials = query
    ? materials
        .filter((item) =>
          [item.title, item.description, item.summary, item.topic, item.category, item.stage, item.file_type, ...(item.tags || [])]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())
        )
        .slice(0, 8)
    : materials.slice(0, 8);
  const policyMaterials = materials
    .filter((item) => (item.topic || item.category) === "制度文件" && item.status !== "draft" && item.status !== "hidden")
    .slice(0, 8);

  return <main className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
    <header className="rounded-3xl border border-[#e3e0db] bg-white p-6 md:p-9">
      <p className="text-sm font-medium text-[#98373a]">工作导航</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#292d2b]">先确定要完成的工作</h1>
      <p className="mt-4 max-w-2xl leading-7 text-neutral-600">搜索结果会优先组织专题、流程、依据、问题和资料，而不是只列文章标题。</p>
      <form className="mt-7 flex flex-col gap-3 sm:flex-row"><input name="q" defaultValue={query} placeholder="输入工作事项，例如：组织生活会、发展党员、支部换届……" className="h-13 flex-1 rounded-xl border border-[#dedad4] bg-[#faf9f7] px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-[#a33a3d]"/><button className="rounded-xl bg-[#a33a3d] px-6 py-3 text-sm font-medium text-white">搜索</button></form>
    </header>

    {query ? <p className="mt-7 text-sm text-neutral-500">“{query}”的工作结果</p> : null}
    <section className="mt-5"><h2 className="text-2xl font-semibold text-[#292d2b]">对应工作专题</h2><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{matchedTopics.map((topic) => <Link key={topic.slug} href={`/topics/${topic.slug}`} className="rounded-2xl border border-[#e3e0db] bg-white p-5"><h3 className="font-semibold text-[#292d2b]">{topic.name}</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{topic.summary}</p><span className="mt-5 inline-block text-sm font-medium text-[#8d2f32]">查看专题 →</span></Link>)}</div>{!matchedTopics.length ? <p className="mt-4 rounded-2xl bg-white p-5 text-sm text-neutral-500">暂未匹配到现成专题，可继续查看相关资料，或换一个更具体的工作事项。</p> : null}</section>

    {matchedTopics.length ? <section className="mt-10 grid gap-4 lg:grid-cols-3"><ResultPanel title="办理流程" items={matchedTopics.flatMap((topic) => topic.steps).slice(0, 8)} /><MaterialResultPanel title="制度依据" items={policyMaterials} /><ResultPanel title="常见问题" items={matchedTopics.flatMap((topic) => topic.faqs.map((faq) => faq.question)).slice(0, 8)} /></section> : null}

    <section className="mt-10"><div className="flex items-end justify-between"><div><p className="text-sm font-medium text-[#98373a]">现有内容</p><h2 className="mt-2 text-2xl font-semibold text-[#292d2b]">可下载资料与相关文章</h2></div><Link href="/library" className="text-sm text-[#8d2f32]">全部资料 →</Link></div><div className="mt-5 grid gap-3 md:grid-cols-2">{matchedMaterials.map((item) => <Link key={item.id} href={`/materials/${item.slug || item.id}`} className="rounded-2xl border border-[#e3e0db] bg-white p-5"><div className="flex gap-2 text-xs text-neutral-500"><span>{item.topic || item.category}</span><span>·</span><span>{item.file_type}</span></div><h3 className="mt-2 font-semibold text-[#292d2b]">{item.title}</h3>{hasDescription(item.description) ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600">{item.description}</p> : null}</Link>)}</div></section>
  </main>;
}

function ResultPanel({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl border border-[#e3e0db] bg-white p-6"><h2 className="font-semibold text-[#292d2b]">{title}</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3"><span className="text-[#a33a3d]">{String(index + 1).padStart(2, "0")}</span><span>{item}</span></li>)}</ol></div>;
}

function MaterialResultPanel({ title, items }: { title: string; items: Material[] }) {
  return <div className="rounded-2xl border border-[#e3e0db] bg-white p-6"><h2 className="font-semibold text-[#292d2b]">{title}</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">{items.map((item, index) => <li key={item.id} className="flex gap-3"><span className="text-[#a33a3d]">{String(index + 1).padStart(2, "0")}</span><Link href={`/materials/${item.slug || item.id}`} className="hover:text-[#8d2f32]">{item.title}</Link></li>)}</ol></div>;
}

function hasDescription(value?: string) {
  return Boolean(value && !["待补充", "暂无", "无"].includes(value.trim()));
}
