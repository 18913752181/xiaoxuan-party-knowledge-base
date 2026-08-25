import type { Metadata } from "next";
import { QuestionEntry } from "@/components/ResourceLibrary";

export const metadata: Metadata = {
  title: "提问",
  description: "提交你遇到的问题或需要补充的资料，查看已公开的答疑。",
  alternates: { canonical: "/questions" }
};

export default function QuestionsPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <section className="rounded-3xl border border-brand-line bg-white p-6 shadow-soft md:p-8">
        <p className="text-sm font-medium tracking-[0.18em] text-[#9a4650]">小宣资料库</p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">提问与答疑</h1>
        <p className="mt-3 text-sm leading-7 text-neutral-500">提交你遇到的问题或想找的资料，我们会持续整理和补充。</p>
        <div className="mt-8">
          <QuestionEntry />
        </div>
      </section>
    </main>
  );
}
