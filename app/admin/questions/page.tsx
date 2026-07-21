"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SubmittedQuestion } from "@/lib/questions";

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<SubmittedQuestion[]>([]);
  const [message, setMessage] = useState("正在读取问题...");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    fetch("/api/admin/questions", { cache: "no-store" })
      .then((response) => response.json())
      .then((rows) => { setQuestions(Array.isArray(rows) ? rows : []); setMessage(""); })
      .catch(() => setMessage("问题读取失败。"));
  }, []);

  function updateLocal(id: string, patch: Partial<SubmittedQuestion>) {
    setQuestions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function save(item: SubmittedQuestion) {
    setSavingId(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, answer: item.answer, isPublic: item.isPublic, status: item.status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      updateLocal(item.id, data.question);
      setMessage("问题处理结果已保存。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingId("");
    }
  }

  return <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">问题管理</h1><p className="mt-3 text-sm text-[#6d746f]">共收到 {questions.length} 个问题</p></div>
        <p className="text-sm text-[#6d746f]">{message}</p>
      </div>
      <div className="mt-7 grid gap-4">
        {questions.map((item) => <article key={item.id} className="rounded-2xl border border-[#e4ded2] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#7a817d]"><span>提交时间：{new Date(item.submittedAt).toLocaleString("zh-CN", { hour12: false })}</span><span>{item.status === "processed" ? "已处理" : "待处理"}</span></div>
          <h2 className="mt-4 text-lg font-semibold leading-8">{item.question}</h2>
          <label className="mt-5 block text-sm font-medium text-[#48524c]">小宣的回答<textarea value={item.answer} onChange={(event) => updateLocal(item.id, { answer: event.target.value })} placeholder="填写回答后，可选择在前台公开" className="mt-2 min-h-28 w-full rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 py-3 text-sm leading-6 outline-none focus:border-[#7f9a8a]" /></label>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-[#59635d]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={item.isPublic} onChange={(event) => updateLocal(item.id, { isPublic: event.target.checked })} />在前台显示</label>
            <label className="flex items-center gap-2">处理状态<select value={item.status} onChange={(event) => updateLocal(item.id, { status: event.target.value as SubmittedQuestion["status"] })} className="rounded-lg border border-[#ddd5c8] bg-white px-3 py-2"><option value="pending">待处理</option><option value="processed">已处理</option></select></label>
            <button type="button" onClick={() => save(item)} disabled={savingId === item.id} className="rounded-full bg-[#6f8f7e] px-5 py-2 text-white disabled:opacity-50">{savingId === item.id ? "保存中" : "保存"}</button>
          </div>
        </article>)}
        {!questions.length && !message ? <div className="rounded-2xl border border-dashed border-[#d8d0c4] p-8 text-center text-sm text-[#7a817d]">暂时还没有收到问题。</div> : null}
      </div>
    </div>
  </main>;
}
