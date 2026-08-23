"use client";

import { useCallback, useEffect, useState } from "react";

type Question = {
  id: string;
  openid: string;
  question: string;
  context_summary: string;
  category: string;
  status: "pending" | "replied" | "closed";
  created_at: string;
  replied_at: string | null;
};

type Reminder = {
  id: string;
  openid: string;
  content: string;
  status: "pending" | "scheduled" | "sent" | "failed" | "done" | "closed";
  scheduled_at: string | null;
  dispatched_at: string | null;
  delivery_error: string | null;
  created_at: string;
};
type Conversation = { id: string; role: "user" | "cat" | "xiaoxuan"; content: string; created_at: string };
type Dashboard = {
  stats: { todayUsers: number; todayMessages: number; pendingQuestions: number };
  pendingQuestions: Question[];
  reminders: Reminder[];
};

const CATEGORY_NAMES: Record<string, string> = {
  reception: "普通接待",
  faq: "固定 FAQ",
  resource_navigation: "资料导航",
  reminder: "提醒 / 留言",
  professional_question: "专业问题"
};

const STATUS_NAMES: Record<string, string> = {
  pending: "待处理", replied: "已回复", closed: "已关闭", done: "已完成",
  scheduled: "等待发送", sent: "已送达", failed: "发送失败"
};

function time(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function shortOpenid(openid: string) {
  return openid.length > 18 ? `${openid.slice(0, 8)}…${openid.slice(-6)}` : openid;
}

export default function WorkCatDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [contextOpenid, setContextOpenid] = useState("");
  const [context, setContext] = useState<Conversation[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/work-cat", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取失败");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function update(id: string, status: string, kind: "question" | "reminder" = "question") {
    setSaving(id);
    setError("");
    try {
      const response = await fetch("/api/admin/work-cat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, kind })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving("");
    }
  }

  async function showContext(openid: string) {
    setContextOpenid(openid);
    setContext([]);
    setContextLoading(true);
    try {
      const response = await fetch(`/api/admin/work-cat?openid=${encodeURIComponent(openid)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "上下文读取失败");
      setContext(payload.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上下文读取失败");
    } finally {
      setContextLoading(false);
    }
  }

  if (loading && !data) return <p className="mt-10 text-sm text-[#68727d]">Dimmo 正在整理今天的值班记录…</p>;

  return (
    <>
      {error ? <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {data ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              ["今日用户数", data.stats.todayUsers],
              ["今日消息数", data.stats.todayMessages],
              ["待小宣回复", data.stats.pendingQuestions]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[#e3e7eb] bg-white p-5 shadow-sm">
                <p className="text-sm text-[#68727d]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">待回复</h2><button onClick={load} className="text-sm text-[#637a70] hover:underline">刷新</button></div>
            <div className="mt-4 space-y-4">
              {data.pendingQuestions.map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#e3e7eb] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#68727d]">
                    <span title={item.openid}>用户 {shortOpenid(item.openid)}</span><span>·</span><span>{CATEGORY_NAMES[item.category] || item.category}</span><span>·</span><span>{time(item.created_at)}</span>
                    <span className={`ml-auto rounded-full px-2.5 py-1 ${item.status === "pending" ? "bg-[#fff1f2] text-[#a63e47]" : "bg-[#f1f3f5]"}`}>{STATUS_NAMES[item.status]}</span>
                  </div>
                  <p className="mt-4 text-base font-medium leading-7">{item.question}</p>
                  <div className="mt-3 rounded-xl bg-[#f6f7f9] px-4 py-3 text-sm leading-6 text-[#68727d] whitespace-pre-wrap">{item.context_summary}</div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm">
                    <button onClick={() => showContext(item.openid)} className="rounded-full border border-[#d5dce0] px-4 py-2 hover:bg-[#f6f7f9]">查看上下文</button>
                    <button disabled={saving === item.id} onClick={() => update(item.id, "replied")} className="rounded-full bg-[#637a70] px-4 py-2 text-white disabled:opacity-50">标记已回复</button>
                    <button disabled={saving === item.id} onClick={() => update(item.id, "closed")} className="rounded-full border border-[#d5dce0] px-4 py-2 disabled:opacity-50">标记关闭</button>
                  </div>
                </article>
              ))}
              {!data.pendingQuestions.length ? <div className="rounded-2xl border border-dashed border-[#d5dce0] p-8 text-center text-sm text-[#68727d]">现在没有待回复问题，Dimmo 的小本子是空的。</div> : null}
            </div>
          </section>

          <section className="mt-10">
            <h2 className="text-xl font-semibold">提醒与留言</h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#e3e7eb] bg-white shadow-sm">
              {data.reminders.map((item) => <div key={item.id} className="border-b border-[#eef0f2] p-4 last:border-0 sm:flex sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6">{item.content}</p>
                  <p className="mt-1 text-xs text-[#89939e]">{shortOpenid(item.openid)} · 创建于 {time(item.created_at)} · {STATUS_NAMES[item.status]}</p>
                  {item.scheduled_at ? <p className="mt-1 text-xs text-[#a77a18]">计划提醒：{time(item.scheduled_at)}{item.dispatched_at ? ` · 实际送达：${time(item.dispatched_at)}` : ""}</p> : null}
                  {item.delivery_error ? <p className="mt-1 text-xs text-[#a63e47]">{item.delivery_error}</p> : null}
                </div>
                <div className="mt-3 flex gap-2 sm:mt-0"><button onClick={() => showContext(item.openid)} className="text-xs text-[#637a70]">上下文</button><button disabled={saving === item.id} onClick={() => update(item.id, "done", "reminder")} className="rounded-full bg-[#f1f3f5] px-3 py-1.5 text-xs">完成</button></div>
              </div>)}
              {!data.reminders.length ? <p className="p-6 text-center text-sm text-[#89939e]">暂无留言</p> : null}
            </div>
          </section>
        </>
      ) : null}

      {contextOpenid ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setContextOpenid(""); }}>
        <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-semibold">最近对话</h3><p className="mt-1 break-all text-xs text-[#89939e]">{contextOpenid}</p></div><button onClick={() => setContextOpenid("")} className="rounded-full bg-[#f1f3f5] px-3 py-1.5 text-sm">关闭</button></div>
          <div className="mt-6 space-y-3">
            {contextLoading ? <p className="text-sm text-[#68727d]">正在翻小本子…</p> : context.map((row) => <div key={row.id} className={`flex ${row.role === "user" ? "justify-start" : "justify-end"}`}><div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 ${row.role === "user" ? "bg-[#f1f3f5]" : "bg-[#edf3ef]"}`}><p className="mb-1 text-xs text-[#89939e]">{row.role === "user" ? "用户" : row.role === "cat" ? "Dimmo" : "小宣"} · {time(row.created_at)}</p><p className="whitespace-pre-wrap">{row.content}</p></div></div>)}
          </div>
        </div>
      </div> : null}
    </>
  );
}
