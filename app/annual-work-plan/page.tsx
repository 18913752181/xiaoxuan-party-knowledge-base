import type { Metadata } from "next";
import Link from "next/link";
import { annualWorkPlan, workTopics } from "@/lib/work-platform";

export const metadata: Metadata = { title: "党支部全年党建工作导航｜宣知党建", description: "按1月至12月梳理党支部常见党建工作，快速进入对应工作专题、流程与资料。" };

export default function AnnualWorkPlanPage({ searchParams }: { searchParams: { month?: string } }) {
  const selectedMonth = Number(searchParams.month);
  const hasSelectedMonth = Number.isInteger(selectedMonth) && selectedMonth >= 1 && selectedMonth <= 12;
  const visibleMonths = hasSelectedMonth ? annualWorkPlan.filter((item) => item.month === selectedMonth) : annualWorkPlan;

  return <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8"><header className="max-w-3xl"><p className="text-sm font-medium text-[#98373a]">独立工作导航</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#292d2b] md:text-5xl">{hasSelectedMonth ? `${selectedMonth}月党建重点工作` : "党支部全年党建工作导航"}</h1><p className="mt-5 leading-8 text-neutral-600">{hasSelectedMonth ? `集中查看${selectedMonth}月常见工作，并直接进入对应专题或资料。` : "一张时间表看清全年常见工作。"} 月份安排用于工作提示，实际时间、主题和程序请以上级党组织通知和本单位制度为准。</p>{hasSelectedMonth ? <Link href="/annual-work-plan" className="mt-5 inline-flex text-sm font-medium text-[#8d2f32]">查看全年工作导航 →</Link> : null}</header><div className={`mt-10 grid gap-4 ${hasSelectedMonth ? "max-w-3xl" : "md:grid-cols-2"}`}>{visibleMonths.map((month) => <section id={`month-${month.month}`} key={month.month} className="scroll-mt-32 rounded-2xl border border-[#e3e0db] bg-white p-6"><div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f3e9e8] font-semibold text-[#98373a]">{month.month}月</span><h2 className="text-xl font-semibold text-[#292d2b]">本月重点工作</h2></div><ul className="mt-5 space-y-3">{month.items.map((item) => { const topic = workTopics.find((candidate) => candidate.aliases.some((alias) => item.includes(alias)) || item.includes(candidate.name)); return <li key={item} className="flex items-center justify-between gap-4 rounded-xl bg-[#f7f6f3] px-4 py-3 text-sm text-neutral-700"><span>{item}</span>{topic ? <Link href={`/topics/${topic.slug}`} className="shrink-0 text-xs font-medium text-[#8d2f32]">查看指南</Link> : <Link href={`/work-navigation?q=${encodeURIComponent(item)}`} className="shrink-0 text-xs font-medium text-[#8d2f32]">查找资料</Link>}</li>; })}</ul></section>)}</div></main>;
}
