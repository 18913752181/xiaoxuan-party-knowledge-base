"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import type { WorkLevel, WorkSection } from "@/lib/work-panorama";

const splitList = (value: string) => value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean);

export default function AdminWorkPanoramaPage() {
  const [levels, setLevels] = useState<WorkLevel[]>([]);
  const [newLevel, setNewLevel] = useState("");
  const [newSections, setNewSections] = useState<Record<string, string>>({});
  const [editingLevel, setEditingLevel] = useState("");
  const [levelDraft, setLevelDraft] = useState<Partial<WorkLevel>>({});
  const [editingSection, setEditingSection] = useState("");
  const [sectionDraft, setSectionDraft] = useState({ name: "", items: "", keywords: "" });
  const [message, setMessage] = useState("正在读取工作全景...");
  const [saving, setSaving] = useState(false);
  // 手机浏览器会拦截 window.confirm，删除确认统一走自绘对话框
  const [confirmState, setConfirmState] = useState<{ title: string; description?: string; action: () => void } | null>(null);

  async function load() {
    const response = await fetch("/api/admin/work-panorama", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "读取失败");
    setLevels(data.levels || []);
    setMessage("");
  }

  useEffect(() => { load(); }, []);

  async function request(method: string, body: object, success: string) {
    setSaving(true);
    const response = await fetch("/api/admin/work-panorama", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "操作失败");
    setLevels(data.levels || []);
    setEditingLevel("");
    setEditingSection("");
    setMessage(success);
  }

  function startLevel(level: WorkLevel) {
    setEditingLevel(level.slug);
    setLevelDraft(level);
  }

  function startSection(level: WorkLevel, section: WorkSection) {
    setEditingSection(`${level.slug}:${section.name}`);
    setSectionDraft({
      name: section.name,
      items: (section.items || []).join("、"),
      keywords: (section.keywords || []).join("、"),
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-5 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
          <Link href="/" className="text-sm text-[#6f8f7e]">查看前台</Link>
        </div>
        <h1 className="mt-4 text-3xl font-semibold">工作全景管理</h1>
        <p className="mt-3 text-sm leading-7 text-[#6d746f]">
          管理工作全景的组织层级和下级分类。删除只会解除专题关联，不会删除专题或资料。
        </p>

        <section className="mt-7 rounded-2xl border border-[#e4ded2] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">新增工作层级</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input value={newLevel} onChange={(event) => setNewLevel(event.target.value)} placeholder="例如：党组工作" className="h-12 flex-1 rounded-xl border border-[#ddd5c8] px-4 outline-none focus:border-[#7f9a8a]" />
            <button disabled={saving} onClick={() => {
              if (!newLevel.trim()) return setMessage("请填写层级名称。");
              request("POST", { name: newLevel }, "工作层级已新增。");
              setNewLevel("");
            }} className="rounded-full bg-[#6f8f7e] px-6 py-3 text-sm text-white disabled:opacity-60">新增层级</button>
          </div>
        </section>

        <div className="mt-6 space-y-5">
          {levels.map((level) => (
            <section key={level.slug} className="rounded-2xl border border-[#e4ded2] bg-white p-5 shadow-sm">
              {editingLevel === level.slug ? (
                <div className="grid gap-3">
                  <input value={levelDraft.name || ""} onChange={(event) => setLevelDraft({ ...levelDraft, name: event.target.value })} className="h-11 rounded-xl border border-[#ddd5c8] px-4" />
                  <input value={levelDraft.shortDescription || ""} onChange={(event) => setLevelDraft({ ...levelDraft, shortDescription: event.target.value })} placeholder="一句话说明" className="h-11 rounded-xl border border-[#ddd5c8] px-4" />
                  <textarea value={levelDraft.description || ""} onChange={(event) => setLevelDraft({ ...levelDraft, description: event.target.value })} placeholder="页面说明" className="min-h-24 rounded-xl border border-[#ddd5c8] px-4 py-3" />
                  <div className="flex gap-2">
                    <button onClick={() => request("PUT", { slug: level.slug, ...levelDraft }, "层级信息已保存。")} className="rounded-full bg-[#6f8f7e] px-5 py-2 text-sm text-white">保存</button>
                    <button onClick={() => setEditingLevel("")} className="rounded-full border px-5 py-2 text-sm">取消</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{level.name}</h2>
                    <p className="mt-1 text-sm text-[#747b76]">{level.shortDescription || "暂无简短说明"}</p>
                    <p className="mt-2 text-xs text-[#9a9f9b]">{level.sections.length} 个分类</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startLevel(level)} className="rounded-full border px-4 py-2 text-sm">修改</button>
                    <button onClick={() => setConfirmState({ title: `确定删除“${level.name}”吗？`, description: "专题和资料不会删除，但相关地图关联会解除。", action: () => void request("DELETE", { slug: level.slug }, "工作层级已删除。") })} className="rounded-full border border-[#ead6d3] px-4 py-2 text-sm text-[#a6404d]">删除</button>
                  </div>
                </div>
              )}

              <div className="mt-5 divide-y divide-[#eee7dc] border-t border-[#eee7dc]">
                {level.sections.map((section) => {
                  const key = `${level.slug}:${section.name}`;
                  return (
                    <div key={key} className="py-4">
                      {editingSection === key ? (
                        <div className="grid gap-3">
                          <input value={sectionDraft.name} onChange={(event) => setSectionDraft({ ...sectionDraft, name: event.target.value })} className="h-11 rounded-xl border border-[#ddd5c8] px-4" />
                          <input value={sectionDraft.items} onChange={(event) => setSectionDraft({ ...sectionDraft, items: event.target.value })} placeholder="具体事项，用顿号分隔" className="h-11 rounded-xl border border-[#ddd5c8] px-4" />
                          <input value={sectionDraft.keywords} onChange={(event) => setSectionDraft({ ...sectionDraft, keywords: event.target.value })} placeholder="检索关键词，用顿号分隔" className="h-11 rounded-xl border border-[#ddd5c8] px-4" />
                          <div className="flex gap-2">
                            <button onClick={() => request("PUT", { type: "section", level: level.slug, oldName: section.name, name: sectionDraft.name, items: splitList(sectionDraft.items), keywords: splitList(sectionDraft.keywords) }, "分类已保存，专题关联已同步。")} className="rounded-full bg-[#6f8f7e] px-4 py-2 text-sm text-white">保存</button>
                            <button onClick={() => setEditingSection("")} className="rounded-full border px-4 py-2 text-sm">取消</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="font-medium">{section.name}</h3>
                            {section.items?.length ? <p className="mt-1 text-xs text-[#909691]">{section.items.join("、")}</p> : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button onClick={() => startSection(level, section)} className="text-sm text-[#6f8f7e]">修改</button>
                            <button onClick={() => setConfirmState({ title: `确定删除分类“${section.name}”吗？`, action: () => void request("DELETE", { type: "section", level: level.slug, name: section.name }, "分类已删除，相关专题关联已解除。") })} className="text-sm text-[#a6404d]">删除</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={newSections[level.slug] || ""} onChange={(event) => setNewSections({ ...newSections, [level.slug]: event.target.value })} placeholder="新增分类名称" className="h-10 min-w-0 flex-1 rounded-xl border border-[#ddd5c8] px-3 text-sm" />
                <button onClick={() => {
                  const name = (newSections[level.slug] || "").trim();
                  if (!name) return setMessage("请填写分类名称。");
                  request("POST", { type: "section", level: level.slug, name }, "分类已新增。");
                  setNewSections({ ...newSections, [level.slug]: "" });
                }} className="rounded-full bg-[#f0ebe3] px-4 py-2 text-sm text-[#59635d]">新增分类</button>
              </div>
            </section>
          ))}
        </div>
        {message ? <p className="mt-5 text-sm text-[#6d746f]">{message}</p> : null}
      </div>
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ""}
        description={confirmState?.description}
        busy={saving}
        onConfirm={() => {
          const action = confirmState?.action;
          setConfirmState(null);
          action?.();
        }}
        onCancel={() => setConfirmState(null)}
      />
    </main>
  );
}
