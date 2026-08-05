"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { WorkLevel } from "@/lib/work-panorama";

type Placement = { level: string; section: string };

export default function AdminTopicsPage() {
  const [topics, setTopics] = useState<string[]>([]);
  const [topicCounts, setTopicCounts] = useState<Record<string, number>>({});
  const [topicPlacements, setTopicPlacements] = useState<Record<string, Placement[]>>({});
  const [workLevels, setWorkLevels] = useState<WorkLevel[]>([]);
  const [mappingTopic, setMappingTopic] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [editing, setEditing] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [message, setMessage] = useState("正在读取专题...");
  const [saving, setSaving] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState("");

  async function loadTopics() {
    setMessage("正在读取专题...");
    const response = await fetch("/api/admin/topics", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "读取专题失败");
      return;
    }
    setTopics(data.topics || []);
    setTopicCounts(data.topicCounts || {});
    setTopicPlacements(data.topicPlacements || {});
    setWorkLevels(data.workLevels || []);
    setMessage("");
  }

  function togglePlacement(topic: string, placement: Placement) {
    setTopicPlacements((current) => {
      const values = current[topic] || [];
      const selected = values.some(
        (item) => item.level === placement.level && item.section === placement.section
      );
      return {
        ...current,
        [topic]: selected
          ? values.filter(
              (item) => !(item.level === placement.level && item.section === placement.section)
            )
          : [...values, placement],
      };
    });
  }

  async function savePlacements(topic: string) {
    setSaving(true);
    const response = await fetch("/api/admin/topics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: topic, placements: topicPlacements[topic] || [] }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "保存工作全景关联失败");
    setTopicPlacements(data.topicPlacements || {});
    setMappingTopic("");
    setMessage(`“${topic}”的工作全景关联已保存。`);
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
    setNewTopic("");
    await loadTopics();
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
    setEditing("");
    setEditingValue("");
    await loadTopics();
    setMessage(`专题已修改，同步更新 ${data.updatedMaterials || 0} 份资料。`);
  }

  // 手机浏览器会拦截 window.confirm，改为自绘对话框：先做资料数量校验，确认后执行删除
  function requestRemove(topic: string) {
    const count = topicCounts[topic] || 0;
    if (count) {
      setMessage(`“${topic}”下还有 ${count} 份资料，请先修改这些资料的所属专题后再删除。`);
      return;
    }
    setPendingDeleteTopic(topic);
  }

  async function confirmRemove() {
    const topic = pendingDeleteTopic;
    if (!topic) return;

    setSaving(true);
    const response = await fetch("/api/admin/topics", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: topic })
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "删除专题失败");
    setTopics(data.topics || []);
    setTopicCounts(data.topicCounts || {});
    setPendingDeleteTopic("");
    setMessage("专题已删除。");
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
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-xl font-semibold">已有专题</h2>
            <span className="text-xs text-[#8b918d]">按资料份数排序</span>
          </div>
          <div className="mt-5 divide-y divide-[#eee7dc]">
            {topics.map((topic, index) => (
              <div key={topic} className="py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {editing === topic ? (
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    className="h-11 flex-1 rounded-xl border border-[#ddd5c8] bg-[#fffdf8] px-4 text-sm outline-none focus:border-[#7f9a8a]"
                  />
                ) : (
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3e9e8] text-xs font-semibold text-[#a6404d]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate text-base font-medium text-[#2f3732]">{topic}</span>
                      <span className="mt-1 block text-xs text-[#8b918d]">{topicCounts[topic] || 0} 份资料</span>
                      <span className="mt-1 block text-xs text-[#8f555b]">
                        已关联 {(topicPlacements[topic] || []).length} 个工作模块
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {editing === topic ? (
                    <>
                      <button type="button" onClick={() => rename(topic)} disabled={saving} className="rounded-full bg-[#6f8f7e] px-4 py-2 text-sm text-white disabled:opacity-60">保存</button>
                      <button type="button" onClick={() => { setEditing(""); setEditingValue(""); }} className="rounded-full border border-[#e4ded2] bg-white px-4 py-2 text-sm text-[#59635d]">取消</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setEditing(topic); setEditingValue(topic); }} className="rounded-full border border-[#e4ded2] bg-white px-4 py-2 text-sm text-[#59635d]">修改名称</button>
                      <button
                        type="button"
                        onClick={() => setMappingTopic(mappingTopic === topic ? "" : topic)}
                        className="rounded-full border border-[#d8cfc5] bg-[#faf7f1] px-4 py-2 text-sm text-[#8f555b]"
                      >
                        关联工作全景
                      </button>
                      <button type="button" onClick={() => requestRemove(topic)} disabled={saving} className="rounded-full border border-[#ead6d3] bg-white px-4 py-2 text-sm text-[#a6404d] disabled:opacity-50">删除</button>
                    </>
                  )}
                </div>
                </div>
                {mappingTopic === topic ? (
                  <div className="mt-4 rounded-2xl border border-[#e4ded2] bg-[#faf8f3] p-5">
                    <p className="text-sm leading-6 text-[#6d746f]">
                      一个专题可以同时位于多个工作模块。这里只建立地图关系，不会复制专题或资料。
                    </p>
                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      {workLevels.map((level) => (
                        <fieldset key={level.slug} className="rounded-xl border border-[#e5ddd4] bg-white p-4">
                          <legend className="px-1 text-sm font-semibold">{level.name}</legend>
                          <div className="mt-2 space-y-3">
                            {level.sections.map((section) => {
                              const checked = (topicPlacements[topic] || []).some(
                                (item) => item.level === level.slug && item.section === section.name
                              );
                              return (
                                <label key={section.name} className="flex cursor-pointer items-start gap-2 text-sm leading-5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      togglePlacement(topic, { level: level.slug, section: section.name })
                                    }
                                    className="mt-1"
                                  />
                                  <span>{section.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => savePlacements(topic)}
                        disabled={saving}
                        className="rounded-full bg-[#6f8f7e] px-5 py-2 text-sm text-white disabled:opacity-60"
                      >
                        保存关联
                      </button>
                      <button
                        type="button"
                        onClick={() => setMappingTopic("")}
                        className="rounded-full border border-[#e4ded2] bg-white px-5 py-2 text-sm"
                      >
                        收起
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {message ? <p className="mt-4 text-sm text-[#6d746f]">{message}</p> : null}
      </div>
      <ConfirmDialog
        open={Boolean(pendingDeleteTopic)}
        title={`确定删除专题“${pendingDeleteTopic}”吗？`}
        busy={saving}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingDeleteTopic("")}
      />
    </main>
  );
}
