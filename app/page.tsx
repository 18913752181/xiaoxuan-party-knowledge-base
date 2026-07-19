import Link from "next/link";
import { contentUnitToMaterial, listContentUnits } from "@/lib/content-units";
import { annualWorkPlan, workTopics } from "@/lib/work-platform";
import { formatDisplayDay } from "@/lib/format-date";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const materials = (await listContentUnits()).map(contentUnitToMaterial);
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthPlan = annualWorkPlan.filter((item) => item.month === currentMonth);
  const latest = materials.slice(0, 6);
  const qaItems = materials.flatMap((material) =>
    extractFaqQuestions(material.faq).map((question) => ({
      question,
      href: `/materials/${material.slug || material.id}`
    }))
  ).filter((item, index, items) => items.findIndex((candidate) => candidate.question === item.question) === index).slice(0, 5);

  return (
    <>
      <section className="border-b border-[#e9e6e1] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
          <p className="text-sm font-medium text-[#98373a]">工作台</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-[#292d2b] md:text-6xl">今天准备完成什么党建工作？</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-600 md:text-lg">查制度、看流程、找模板，把党建工作一步一步做清楚。</p>
          <form action="/work-navigation" className="mt-8 flex max-w-4xl flex-col gap-3 rounded-2xl border border-[#dfdcd7] bg-[#f6f5f2] p-3 shadow-[0_14px_40px_rgba(52,49,45,0.07)] sm:flex-row">
            <label htmlFor="home-work-search" className="sr-only">搜索党建工作事项</label>
            <input id="home-work-search" name="q" placeholder="输入工作事项，例如：组织生活会、发展党员、支部换届……" className="h-14 flex-1 rounded-xl bg-white px-5 text-sm outline-none ring-[#a33a3d] placeholder:text-neutral-400 focus:ring-2" />
            <button className="h-14 rounded-xl bg-[#a33a3d] px-7 text-sm font-medium text-white transition hover:bg-[#852c2f]" type="submit">查找</button>
          </form>
          <p className="mt-4 text-sm text-neutral-500">搜索会同时匹配工作专题、办理流程、制度依据、常见问题和资料。</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <SectionTitle eyebrow="全年安排" title="党建工作导航" description="按月份梳理常见工作，具体安排请以上级党组织当年通知和本单位实际为准。" action={{ href: "/annual-work-plan", label: "查看全年导航" }} />
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {currentMonthPlan.map((month) => (
            <Link key={month.month} href={`/annual-work-plan?month=${month.month}`} className="rounded-2xl border border-[#e5e2dd] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#c9aaa8] hover:shadow-sm">
              <span className="text-sm font-semibold text-[#98373a]">{month.month}月</span>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-600">{month.items.slice(0, 3).map((item) => <li key={item}>· {item}</li>)}</ul>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e9e6e1] bg-[#f3f3f1]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <SectionTitle eyebrow="高频工作" title="从规定动作出发" description="进入专题后，可以顺着流程、清单、制度依据和模板逐项查看。" />
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workTopics.slice(0, 4).map((topic, index) => (
              <Link key={topic.slug} href={`/topics/${topic.slug}`} className="flex min-h-[13rem] flex-col rounded-2xl border border-[#e2dfda] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#c9aaa8] hover:shadow-sm">
                <span className="text-xs font-semibold text-[#a33a3d]">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-5 text-xl font-semibold text-[#292d2b]">{topic.name}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-neutral-600">{topic.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#e9e6e1] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
          <SectionTitle eyebrow="内容更新" title="最新制度与实务更新" description="围绕制度要求、办理方法和可直接使用的资料持续整理。" action={{ href: "/library", label: "进入资料库" }} />
          <div className="mt-7 divide-y divide-[#ece9e4] border-y border-[#ece9e4]">
            {latest.map((item) => (
              <article key={item.id} className="grid gap-2 py-5 transition hover:bg-[#faf9f7] md:grid-cols-[1fr_180px_120px_110px] md:items-center md:px-3">
                <Link href={`/materials/${item.slug || item.id}`} className="font-medium text-[#292d2b] hover:text-[#8d2f32]">{item.title}</Link>
                <span className="text-sm text-neutral-500">{item.topic || item.category}</span>
                <span className="text-sm text-neutral-500">{formatDisplayDay(item.updated_at)}</span>
                {item.member_only ? <Link href="/membership" className="w-fit rounded-full bg-[#f3efea] px-3 py-1 text-xs text-neutral-600 transition hover:bg-[#eadfda] hover:text-[#8d2f32]">会员专属</Link> : <span className="w-fit rounded-full bg-[#f3efea] px-3 py-1 text-xs text-neutral-600">普通下载</span>}
              </article>
            ))}
            {!latest.length ? <p className="py-8 text-sm text-neutral-500">现有内容正在整理，稍后会在这里显示。</p> : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="rounded-2xl border border-[#e5e2dd] bg-white p-6 md:p-8">
          <p className="text-sm font-medium text-[#98373a]">常见问题</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#292d2b]">最近大家都在查</h2>
          <div className="mt-6 divide-y divide-[#ece9e4]">
            {qaItems.map((item) => <Link key={item.question} href={item.href} className="flex items-center justify-between py-4 text-sm text-neutral-700 hover:text-[#8d2f32]"><span>{item.question}</span><span>→</span></Link>)}
            {!qaItems.length ? <p className="py-4 text-sm text-neutral-500">资料知识网络中暂无Q&amp;A。</p> : null}
          </div>
        </div>
        <div className="rounded-2xl bg-[#303633] p-7 text-white md:p-8">
          <p className="text-sm text-white/65">AI党建助手 · 功能持续完善中</p>
          <h2 className="mt-3 text-2xl font-semibold">拿不准制度要求或工作流程？</h2>
          <p className="mt-4 leading-7 text-white/75">可以先从工作导航查找；宣知党建助手将逐步提供更深入的制度和流程问答。</p>
          <Link href="/ai-assistant" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-medium text-[#303633]">开始提问</Link>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: { href: string; label: string } }) {
  return <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-medium text-[#98373a]">{eyebrow}</p><h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#292d2b]">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">{description}</p></div>{action ? <Link href={action.href} className="text-sm font-medium text-[#8d2f32]">{action.label} →</Link> : null}</div>;
}

function extractFaqQuestions(faq?: string) {
  if (!faq) return [];
  return faq
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:#{1,6}|[-*+] |\d+[.)]\s*)/, "").replace(/^Q\d+[：:]\s*/i, "").replace(/\*\*/g, "").trim())
    .filter((line) => line.length >= 4 && line.length <= 80 && /[？?]$/.test(line));
}
