"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [editing, setEditing] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState("正在读取专题...");
  const [saving, setSaving] = useState(false);

  async function loadTopics() {
    setMessage("正在读取专题...");
    const response = await fetch("/api/admin/topics", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "读取专题失败");
      return;
    }
    setTopics(data.topics || []);
    setMessage("");
  }

  useEffect(() => {
    loadTopics();
  }, []);

  async function add() {
    const name = newTopic.trim();
    if (!name) return setMessage("请填写专题名称。");
    setSaving(true);
    const response = await fetch("/api/admin/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "新增专题失败");
    setTopics(data.topics || []);
    setNewTopic("");
    setMessage("专题已新增。");
  }

  async function rename(oldName: string) {
    const newName = editingValue.trim();
    if (!newName) return setMessage("请填写新的专题名称。");
    setSaving(true);
    const response = await fetch("/api/admin/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName })
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "修改专题失败");
    setTopics(data.topics || []);
    setEditing("");
    setEditingValue("");
    setMessage(`专题已修改，同步更新 ${data.updatedMaterials || 0} 份资料。`);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
          <Link href="/admin/new" className="text-sm text-[#6f8f7e]">新增资料</Link>
        </div>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">专题管理</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6d746f]">
          管理后台录入资料时可选择的专题。修改专题名称后，会同步更新已有资料的专题字段，前台筛选会随之变化。
        </p>

        <section className="mt-8 rounded-2xl border border-[#e4ded2] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">新增专题</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={newTopic}
              onChange={(event) => setNewTopic(event.target.value)}
              placeholder="例如：党课课件"
              className="h-12 flex-1 rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#7f9a8a]"
            />
            <button type="button" onClick={add} disabled={saving} className="rounded-full bg-[#6f8f7e] px-6 py-3 text-sm font-medium text-white disabled:opacity-60">
              新增专题
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#e4ded2] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">已有专题</h2>
          <div className="mt-5 divide-y divide-[#eee7dc]">
            {topics.map((topic) => (
              <div key={topic} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                {editing === topic ? (
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="h-11 flex-1 rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#7f9a8a]"
                  />
                ) : (
                  <span className="text-base font-medium text-[#2f3732]">{topic}</span>
                )}
                <div className="flex gap-2">
                  {editing === topic ? (
                    <>
                      <button type="button" onClick={() => rename(topic)} disabled={saving} className="rounded-full bg-[#6f8f7e] px-4 py-2 text-sm text-white disabled:opacity-60">保存</button>
                      <button type="button" onClick={() => { setEditing(""); setEditingValue(""); }} className="rounded-full border border-[#e4ded2] bg-white px-4 py-2 text-sm text-[#59635d]">取消</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setEditing(topic); setEditingValue(topic); }} className="rounded-full border border-[#e4ded2] bg-white px-4 py-2 text-sm text-[#59635d]">修改名称</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {message ? <p className="mt-4 text-sm text-[#6d746f]">{message}</p> : null}
      </div>
    </main>
  );
}
