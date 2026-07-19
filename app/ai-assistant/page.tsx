import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "宣知党建助手｜宣知党建", description: "宣知党建助手正在持续完善中。" };

export default function AiAssistantPage() { return <main className="mx-auto max-w-4xl px-5 py-16 lg:px-8"><section className="rounded-3xl border border-[#e3e0db] bg-white p-8 md:p-12"><p className="text-sm font-medium text-[#98373a]">AI党建助手</p><h1 className="mt-3 text-4xl font-semibold text-[#292d2b]">功能持续完善中</h1><p className="mt-5 max-w-2xl leading-8 text-neutral-600">拿不准制度要求或工作流程时，未来可以在这里向宣知党建助手提问。当前请先使用工作导航，查找对应专题、流程、制度依据和资料。</p><Link href="/work-navigation" className="mt-7 inline-flex rounded-xl bg-[#a33a3d] px-5 py-3 text-sm font-medium text-white">先去工作导航</Link></section></main>; }
