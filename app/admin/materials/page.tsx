"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayDate } from "@/lib/format-date";
import type { Material } from "@/lib/types";

const statusLabels: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  hidden: "已隐藏"
};

function uniqueMaterials(rows: Material[]) {
  const seen = new Set<string>();
  return rows.filter((item) => {
    const slug = item.slug || item.id;
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [message, setMessage] = useState("正在读取资料...");
  const [deletingSlug, setDeletingSlug] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [draggingSlug, setDraggingSlug] = useState("");
  const [savingOrder, setSavingOrder] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [topic, setTopic] = useState("全部分类");
  const dragInProgressRef = useRef(false);

  const topics = useMemo(
    () =>
      Array.from(
        new Set(materials.map((item) => item.topic || item.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return materials.filter((item) => {
      const itemTopic = item.topic || item.category || "";
      const searchable = [
        item.title,
        itemTopic,
        item.stage,
        item.file_type,
        ...(item.tags || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (topic === "全部分类" || itemTopic === topic) && (!query || searchable.includes(query));
    });
  }, [keyword, materials, topic]);

  const loadMaterials = useCallback(async () => {
    setMessage("正在读取资料...");
    try {
      const response = await fetch("/api/admin/materials", { cache: "no-store" });
      if (!response.ok) throw new Error("资料读取失败");
      const rows = await response.json();
      setMaterials(Array.isArray(rows) ? uniqueMaterials(rows) : []);
      setSelectedSlugs([]);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? `读取失败：${error.message}` : "读取失败");
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  async function deleteMaterial(item: Material) {
    const slug = item.slug || item.id;
    const confirmed = window.confirm(`确定删除「${item.title}」吗？该操作会删除 content 中对应资料文件夹，前台也将不再显示。`);
    if (!confirmed) return;

    setDeletingSlug(slug);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/materials/${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      setMaterials((current) => current.filter((row) => (row.slug || row.id) !== slug));
      setSelectedSlugs((current) => current.filter((selectedSlug) => selectedSlug !== slug));
      setMessage(`已删除：${item.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingSlug("");
    }
  }

  function toggleSelected(slug: string) {
    setSelectedSlugs((current) =>
      current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]
    );
  }

  function toggleAllFiltered() {
    const filteredSlugs = filteredMaterials.map((item) => item.slug || item.id);
    const allSelected = filteredSlugs.length > 0 && filteredSlugs.every((slug) => selectedSlugs.includes(slug));
    setSelectedSlugs((current) =>
      allSelected
        ? current.filter((slug) => !filteredSlugs.includes(slug))
        : Array.from(new Set([...current, ...filteredSlugs]))
    );
  }

  async function updateMembership(memberOnly: boolean) {
    if (!selectedSlugs.length) return;
    setBulkUpdating(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: selectedSlugs, memberOnly })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "批量修改失败");

      const updatedRows = new Map<string, Material>(
        (Array.isArray(data.materials) ? data.materials : []).map((item: Material) => [item.slug || item.id, item])
      );
      setMaterials((current) =>
        current.map((item) => updatedRows.get(item.slug || item.id) || item)
      );
      setMessage(`已将 ${updatedRows.size} 份资料设为${memberOnly ? "会员专属" : "普通资料"}。`);
      setSelectedSlugs([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量修改失败");
    } finally {
      setBulkUpdating(false);
    }
  }

  async function saveOrder(nextMaterials: Material[]) {
    const uniqueNextMaterials = uniqueMaterials(nextMaterials);
    if (uniqueNextMaterials.length !== materials.length) {
      setMessage("检测到重复资料，已自动刷新列表，请重新拖动排序。");
      await loadMaterials();
      return;
    }

    setSavingOrder(true);
    setMessage("正在保存资料顺序...");
    try {
      const response = await fetch("/api/admin/materials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: uniqueNextMaterials.map((item) => item.slug || item.id) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "顺序保存失败");
      setMaterials(Array.isArray(data.materials) ? uniqueMaterials(data.materials) : uniqueNextMaterials);
      setMessage("资料顺序已保存，前台展示顺序已同步更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "顺序保存失败");
      await loadMaterials();
    } finally {
      setSavingOrder(false);
    }
  }

  function moveVisibleMaterial(targetSlug: string, sourceSlug = draggingSlug) {
    if (!sourceSlug || sourceSlug === targetSlug || savingOrder || dragInProgressRef.current) return;
    dragInProgressRef.current = true;

    const visibleSlugs = filteredMaterials.map((item) => item.slug || item.id);
    const fromIndex = visibleSlugs.indexOf(sourceSlug);
    const toIndex = visibleSlugs.indexOf(targetSlug);
    if (fromIndex < 0 || toIndex < 0) {
      dragInProgressRef.current = false;
      return;
    }

    const reorderedVisible = [...visibleSlugs];
    const [movedSlug] = reorderedVisible.splice(fromIndex, 1);
    reorderedVisible.splice(toIndex, 0, movedSlug);

    let visibleIndex = 0;
    const visibleSet = new Set(visibleSlugs);
    const materialMap = new Map(materials.map((item) => [item.slug || item.id, item]));
    const nextMaterials = uniqueMaterials(
      materials.map((item) => {
        if (!visibleSet.has(item.slug || item.id)) return item;
        const replacementSlug = reorderedVisible[visibleIndex++];
        return materialMap.get(replacementSlug) || item;
      })
    );

    setMaterials(nextMaterials);
    setDraggingSlug("");
    void saveOrder(nextMaterials).finally(() => {
      dragInProgressRef.current = false;
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f4ed] px-6 py-10 text-[#2f3732]">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-[#6f8f7e]">返回后台</Link>
            <h1 className="mt-4 text-3xl font-semibold">资料列表</h1>
            <p className="mt-3 text-sm text-[#6d746f]">
              {keyword || topic !== "全部分类"
                ? `找到 ${filteredMaterials.length} 份资料，共 ${materials.length} 份`
                : `共有 ${materials.length} 份资料`}
            </p>
            <p className="mt-2 text-xs text-[#8b918d]">按住资料行左侧的拖动柄，即可调整前台展示顺序。</p>
          </div>
          <Link href="/admin/new" className="rounded-full bg-[#6f8f7e] px-5 py-2 text-sm text-white">新增资料</Link>
        </div>

        {message ? <p className="mt-6 text-sm text-[#6d746f]">{message}</p> : null}

        <section className="mt-6 rounded-2xl border border-[#e4ded2] bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
            <label>
              <span className="sr-only">搜索资料</span>
              <input
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索标题、阶段、文件类型或标签"
                className="h-11 w-full rounded-xl border border-[#ddd6cc] bg-[#fffdf9] px-4 text-sm outline-none focus:border-[#6f8f7e]"
              />
            </label>
            <label>
              <span className="sr-only">按分类筛选</span>
              <select
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className="h-11 w-full rounded-xl border border-[#ddd6cc] bg-[#fffdf9] px-4 text-sm outline-none focus:border-[#6f8f7e]"
              >
                <option>全部分类</option>
                {topics.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
            {keyword || topic !== "全部分类" ? (
              <button
                type="button"
                onClick={() => {
                  setKeyword("");
                  setTopic("全部分类");
                }}
                className="h-11 rounded-xl border border-[#ddd6cc] px-4 text-sm text-[#6d746f]"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        </section>

        {selectedSlugs.length ? (
          <section className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d8d0c4] bg-[#fffdf9] px-4 py-3 shadow-sm">
            <span className="text-sm font-medium text-[#465149]">已选择 {selectedSlugs.length} 份资料</span>
            <button
              type="button"
              onClick={() => updateMembership(true)}
              disabled={bulkUpdating}
              className="rounded-xl bg-[#9b744f] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              设为会员专属
            </button>
            <button
              type="button"
              onClick={() => updateMembership(false)}
              disabled={bulkUpdating}
              className="rounded-xl border border-[#cfc6ba] bg-white px-4 py-2 text-sm text-[#59635d] disabled:opacity-50"
            >
              设为普通资料
            </button>
            <button type="button" onClick={() => setSelectedSlugs([])} disabled={bulkUpdating} className="text-sm text-[#6d746f] disabled:opacity-50">
              取消选择
            </button>
          </section>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e4ded2] bg-white shadow-sm">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-[#fbfaf6] text-[#59635d]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="选择当前筛选的全部资料"
                    checked={filteredMaterials.length > 0 && filteredMaterials.every((item) => selectedSlugs.includes(item.slug || item.id))}
                    onChange={toggleAllFiltered}
                    className="h-4 w-4 accent-[#6f8f7e]"
                  />
                </th>
                <th className="w-16 px-4 py-3">排序</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">专题</th>
                <th className="px-4 py-3">阶段</th>
                <th className="px-4 py-3">文件类型</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">是否会员专属</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => {
                const slug = item.slug || item.id;
                return (
                  <tr
                    key={item.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                          const sourceSlug =
                            event.dataTransfer.getData("text/plain") || draggingSlug;
                      moveVisibleMaterial(slug, sourceSlug);
                    }}
                    className={`border-t border-[#eee8dc] transition-colors ${draggingSlug === slug ? "bg-[#f2eee5] opacity-60" : "hover:bg-[#fffdf9]"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`选择${item.title}`}
                        checked={selectedSlugs.includes(slug)}
                        onChange={() => toggleSelected(slug)}
                        className="h-4 w-4 accent-[#6f8f7e]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        draggable={!savingOrder}
                        aria-label={`拖动调整${item.title}的顺序`}
                        title="按住拖动调整顺序"
                        onDragStart={(event) => {
                          setDraggingSlug(slug);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", slug);
                        }}
                        onDragEnd={() => setDraggingSlug("")}
                        className="cursor-grab select-none rounded-lg border border-[#ddd6cc] bg-[#fbfaf6] px-2 py-1 text-base leading-none text-[#7c847f] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={savingOrder}
                      >
                        ⋮⋮
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{item.topic || item.category}</td>
                    <td className="px-4 py-3">{item.stage || "-"}</td>
                    <td className="px-4 py-3">{item.file_type}</td>
                    <td className="px-4 py-3">{statusLabels[item.status || "published"] || item.status || "已发布"}</td>
                    <td className="px-4 py-3">
                      <span className={item.member_only ? "font-medium text-[#9b744f]" : "text-[#6d746f]"}>
                        {item.member_only ? "是" : "否"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDisplayDate(item.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link href={`/admin/materials/${slug}/edit`} className="text-[#6f8f7e]">编辑</Link>
                        <Link href={`/materials/${slug}`} className="text-[#6f8f7e]">预览</Link>
                        <button type="button" onClick={() => deleteMaterial(item)} disabled={deletingSlug === slug} className="text-[#a35c4f] disabled:opacity-50">
                          {deletingSlug === slug ? "删除中" : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredMaterials.length && !message ? (
                <tr className="border-t border-[#eee8dc]">
                  <td colSpan={10} className="px-4 py-10 text-center text-[#6d746f]">
                    没有找到符合条件的资料，请更换关键词或分类。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
