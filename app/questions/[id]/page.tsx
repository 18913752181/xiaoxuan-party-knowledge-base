"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { SubmittedQuestion } from "@/lib/questions";

export default function QuestionDetailPage() {
  const params = useParams<{ id: string }>();
  const [question, setQuestion] = useState<SubmittedQuestion | null>(null);
  const [message, setMessage] = useState("正在读取问题...");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/questions/${encodeURIComponent(params.id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取失败");
        setQuestion(data); setMessage("");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "读取失败"));
  }, [params.id]);

  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const content = String(form.get("answer") || "").trim();
    if (!content) return;
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(params.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "回答提交失败");
      setQuestion(data.question); formElement.reset(); setMessage("回答已发布。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "回答提交失败");
    } finally { setSubmitting(false); }
  }

  if (!question) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12 text-sm text-neutral-500">{message}</main>;

  return <main className="mx-auto max-w-3xl px-5 py-10">
    <Link href="/#submit-question" className="text-sm text-[#6f8b7b]">返回首页</Link>
    <article className="mt-5 rounded-3xl border border-[#e3d8cf] bg-white p-6 md:p-8">
      <p className="text-sm font-medium text-[#9a4650]">问题</p>
      <h1 className="mt-3 text-2xl font-semibold leading-10 text-brand-ink">{question.question}</h1>
      <div className="mt-7 rounded-2xl bg-[#f7f2ed] p-5"><p className="text-sm font-semibold text-[#9a4650]">小宣的回答</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-600">{question.answer}</p></div>
    </article>
    <section className="mt-5 rounded-3xl border border-[#e3d8cf] bg-white p-6 md:p-8">
      <h2 className="text-xl font-semibold text-brand-ink">大家的回答</h2>
      <form onSubmit={submitAnswer} className="mt-5"><textarea name="answer" required maxLength={1000} placeholder="说说你的经验或建议" className="min-h-28 w-full rounded-2xl border border-[#ded5ca] bg-[#fffdf9] px-4 py-3 text-sm leading-7 outline-none focus:border-[#9a4650]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-neutral-400">回答提交后会显示在本页</span><button type="submit" disabled={submitting} className="rounded-xl bg-[#9a4650] px-5 py-2.5 text-sm text-white disabled:opacity-50">{submitting ? "提交中" : "提交回答"}</button></div></form>
      {message ? <p className="mt-3 text-sm text-[#6f8b7b]">{message}</p> : null}
      <div className="mt-6 divide-y divide-[#eee8e0]">{question.visitorAnswers.map((item) => <article key={item.id} className="py-5 first:pt-0"><p className="whitespace-pre-wrap text-sm leading-7 text-neutral-600">{item.content}</p><p className="mt-2 text-xs text-neutral-400">访问者回答 · {new Date(item.submittedAt).toLocaleString("zh-CN", { hour12: false })}</p></article>)}{!question.visitorAnswers.length ? <p className="py-5 text-sm text-neutral-400">还没有访问者回答，欢迎分享你的看法。</p> : null}</div>
    </section>
  </main>;
}
