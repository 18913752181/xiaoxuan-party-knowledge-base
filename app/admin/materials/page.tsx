"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import MoveMaterialDialog from "@/components/admin/MoveMaterialDialog";
import type { Material } from "@/lib/types";

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
  const [pendingDelete, setPendingDelete] = useState<Material | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [movingSlug, setMovingSlug] = useState("");
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

  const movingIndex = filteredMaterials.findIndex((item) => (item.slug || item.id) === movingSlug);
  const movingMaterial = filteredMaterials[movingIndex];

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

  // 手机浏览器会拦截 window.confirm，改为自绘对话框：先记录待删除项，确认后执行
  function requestDelete(item: Material) {
    setPendingDelete(item);
  }

  async function confirmDeleteMaterial() {
    const item = pendingDelete;
    if (!item) return;
    const slug = item.slug || item.id;

    setDeletingSlug(slug);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/materials/${encodeURIComponent(slug)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "删除失败");
      setMaterials((current) => current.filter((row) => (row.slug || row.id) !== slug));
      setSelectedSlugs((current) => current.filter((selectedSlug) => selectedSlug !== slug));
      setMessage(`已删除：${item.title}`);
      setPendingDelete(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingSlug("");
    }
  }

  async function confirmBulkDelete() {
    const slugs = [...selectedSlugs];
    if (!slugs.length) {
      setBulkDeleteOpen(false);
      return;
    }

    setBulkDeleting(true);
    setMessage(`正在删除 0 / ${slugs.length} 份资料...`);
    const deletedSlugs: string[] = [];
    const failures: string[] = [];

    for (let index = 0; index < slugs.length; index += 1) {
      const slug = slugs[index];
      const material = materials.find((item) => (item.slug || item.id) === slug);
      try {
        const response = await fetch(`/api/admin/materials/${encodeURIComponent(slug)}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "删除失败");
        deletedSlugs.push(slug);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "删除失败";
        failures.push(`${material?.title || slug}：${reason}`);
      }
      setMessage(`正在删除 ${index + 1} / ${slugs.length} 份资料...`);
    }

    const deletedSet = new Set(deletedSlugs);
    setMaterials((current) => current.filter((item) => !deletedSet.has(item.slug || item.id)));
    setSelectedSlugs(failures.length ? slugs.filter((slug) => !deletedSet.has(slug)) : []);
    setBulkDeleteOpen(false);
    setBulkDeleting(false);

    if (!failures.length) {
      setMessage(`已删除 ${deletedSlugs.length} 份资料。`);
      return;
    }

    const failureSummary = failures.slice(0, 3).join("；");
    const remaining = failures.length > 3 ? `；另有 ${failures.length - 3} 份失败` : "";
    setMessage(`已删除 ${deletedSlugs.length} 份，${failures.length} 份未删除：${failureSummary}${remaining}`);
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
    if (!selectedSlugs.length || bulkUpdating || bulkDeleting) return;
    setBulkUpdating(true);
    setMessage("");
    const slugs = [...selectedSlugs];
    try {
      const response = await fetch("/api/admin/materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs, memberOnly })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "批量修改失败，请稍后重试。");

      const updated = new Set<string>(data.updatedSlugs);
      setMaterials((current) => current.map((item) =>
        updated.has(item.slug || item.id) ? { ...item, member_only: memberOnly, isVip: memberOnly } : item
      ));
      setSelectedSlugs((current) => current.filter((slug) => !updated.has(slug)));
      const failed = slugs.length - updated.size;
      setMessage(`已将 ${updated.size} 份资料设为${memberOnly ? "会员资料" : "普通资料"}。${failed ? `${failed} 份未更新，仍保留选中，请刷新列表或重试。` : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量修改失败，请稍后重试。");
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
      await loadMaterials();
      setMessage(error instanceof Error ? error.message : "顺序保存失败");
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

    setDraggingSlug("");
    void saveOrder(nextMaterials).finally(() => {
      dragInProgressRef.current = false;
    });
  }

  // ---- 内联编辑（双击单元格直接修改） ----
  type EditableField = "stage" | "previous" | "next";
  const [editingCell, setEditingCell] = useState<{ slug: string; field: EditableField } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);

  function startCellEdit(slug: string, field: EditableField, current: string) {
    if (savingCell) return;
    setEditingCell({ slug, field });
    setEditingValue(current);
  }

  async function saveCellEdit(item: Material) {
    if (!editingCell) return;
    const slug = item.slug || item.id;
    const field = editingCell.field;
    setSavingCell(true);
    try {
      const body: Record<string, unknown> =
        field === "stage"
          ? { stage: editingValue.trim() }
          : { [field]: editingValue ? [editingValue] : [] };
      const response = await fetch(`/api/admin/materials/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      if (data.material) {
        setMaterials((current) =>
          current.map((row) => ((row.slug || row.id) === slug ? data.material : row))
        );
      }
      setMessage("已保存。");
      setEditingCell(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingCell(false);
    }
  }

  function cellEditKeyDown(event: KeyboardEvent, item: Material) {
    if (event.key === "Enter") void saveCellEdit(item);
    if (event.key === "Escape") setEditingCell(null);
  }

  /** 可编辑单元格：阶段为文本输入；上一步/下一步为资料标题下拉选择（可选「无」）。 */
  function renderEditableCell(item: Material, field: EditableField, display: string, relationOptions?: string[]) {
    const slug = item.slug || item.id;
    const isEditing = editingCell?.slug === slug && editingCell.field === field;
    return (
      <td
        className="cursor-text px-4 py-3"
        title="双击直接修改"
        onDoubleClick={() => startCellEdit(slug, field, display === "-" ? "" : display)}
      >
        {isEditing ? (
          relationOptions ? (
            <select
              autoFocus
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onBlur={() => void saveCellEdit(item)}
              onKeyDown={(event) => cellEditKeyDown(event, item)}
              disabled={savingCell}
              className="w-full min-w-[140px] rounded-lg border border-[#6f8f7e] bg-white px-2 py-1 text-sm outline-none"
            >
              <option value="">（无）</option>
              {relationOptions.map((title) => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onBlur={() => void saveCellEdit(item)}
              onKeyDown={(event) => cellEditKeyDown(event, item)}
              disabled={savingCell}
              className="w-full min-w-[120px] rounded-lg border border-[#6f8f7e] bg-white px-2 py-1 text-sm outline-none"
            />
          )
        ) : (
          display
        )}
      </td>
    );
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
            <p className="mt-2 text-xs text-[#8b918d]">拖动或点击「移动」调整当前列表顺序；阶段、上一步工作、下一步工作可双击直接修改。</p>
          </div>
          <Link href="/admin/new" className="rounded-full bg-[#6f8f7e] px-5 py-2 text-sm text-white">新增资料</Link>
        </div>

        {message ? <p role="status" className="mt-6 text-sm text-[#6d746f]">{message}</p> : null}

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
            <button type="button" onClick={() => void updateMembership(true)} disabled={bulkUpdating || bulkDeleting} className="rounded-xl border border-[#cfc6ba] bg-white px-4 py-2 text-sm text-[#59635d] disabled:opacity-50">
              设为会员资料
            </button>
            <button type="button" onClick={() => void updateMembership(false)} disabled={bulkUpdating || bulkDeleting} className="rounded-xl border border-[#cfc6ba] bg-white px-4 py-2 text-sm text-[#59635d] disabled:opacity-50">
              设为普通资料
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={bulkDeleting || bulkUpdating}
              className="rounded-xl border border-[#dfbcbc] bg-white px-4 py-2 text-sm font-medium text-[#a34850] disabled:opacity-50"
            >
              批量删除
            </button>
            <button type="button" onClick={() => setSelectedSlugs([])} disabled={bulkDeleting || bulkUpdating} className="text-sm text-[#6d746f] disabled:opacity-50">
              取消选择
            </button>
          </section>
        ) : null}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#e4ded2] bg-white shadow-sm">
          <table className="w-full min-w-[1160px] text-left text-sm">
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
                <th className="w-24 px-4 py-3">排序</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">专题</th>
                <th className="px-4 py-3">阶段</th>
                <th className="px-4 py-3">上一步工作</th>
                <th className="px-4 py-3">下一步工作</th>
                <th className="whitespace-nowrap px-4 py-3">会员资料</th>
                <th className="sticky right-0 bg-[#fbfaf6] px-4 py-3 shadow-[-8px_0_10px_-8px_rgba(60,50,40,0.25)]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => {
                const slug = item.slug || item.id;
                return (
                  <tr
                    key={item.id}
                    onDragOver={(event) => {
                      if (draggingSlug && !savingOrder) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(event) => {
                      if (!draggingSlug || savingOrder) return;
                      event.preventDefault();
                      moveVisibleMaterial(slug);
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
                          draggable={!savingOrder && filteredMaterials.length > 1}
                          aria-label={`移动${item.title}`}
                          aria-haspopup="dialog"
                          title="点击选择位置，或按住拖动"
                          onClick={() => setMovingSlug(slug)}
                          onDragStart={(event) => {
                            setDraggingSlug(slug);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", slug);
                          }}
                          onDragEnd={() => setDraggingSlug("")}
                          className="inline-flex min-h-11 cursor-grab select-none items-center gap-1 whitespace-nowrap rounded-lg px-2 text-sm text-[#59635d] hover:bg-[#f2eee5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#59635d] active:cursor-grabbing disabled:cursor-default disabled:opacity-50"
                          disabled={savingOrder || filteredMaterials.length < 2}
                        >
                          <span aria-hidden="true" className="text-base leading-none">⋮⋮</span>
                          移动
                        </button>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{item.topic || item.category}</td>
                    {renderEditableCell(item, "stage", item.stage || "-")}
                    {renderEditableCell(
                      item,
                      "previous",
                      (item.relatedMap?.previous || []).join("、") || "-",
                      Array.from(new Set(materials.filter((row) => (row.slug || row.id) !== slug).map((row) => row.title)))
                    )}
                    {renderEditableCell(
                      item,
                      "next",
                      (item.relatedMap?.next || []).join("、") || "-",
                      Array.from(new Set(materials.filter((row) => (row.slug || row.id) !== slug).map((row) => row.title)))
                    )}
                    <td className="px-4 py-3">{item.member_only ? "是" : "否"}</td>
                    <td className="sticky right-0 bg-white px-4 py-3 shadow-[-8px_0_10px_-8px_rgba(60,50,40,0.25)]">
                      <div className="flex flex-wrap gap-3">
                        <Link prefetch={false} href={`/admin/materials/${slug}/edit`} className="text-[#6f8f7e]">编辑</Link>
                        <Link prefetch={false} href={`/materials/${slug}`} className="text-[#6f8f7e]">预览</Link>
                        <button type="button" onClick={() => requestDelete(item)} disabled={deletingSlug === slug} className="text-[#a35c4f] disabled:opacity-50">
                          {deletingSlug === slug ? "删除中" : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredMaterials.length && !message ? (
                <tr className="border-t border-[#eee8dc]">
                  <td colSpan={9} className="px-4 py-10 text-center text-[#6d746f]">
                    没有找到符合条件的资料，请更换关键词或分类。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {movingMaterial ? (
        <MoveMaterialDialog
          key={movingSlug}
          title={movingMaterial.title}
          position={movingIndex + 1}
          total={filteredMaterials.length}
          filtered={filteredMaterials.length !== materials.length}
          onClose={() => setMovingSlug("")}
          onMove={(position) => {
            const target = filteredMaterials[position - 1];
            if (!target) return;
            setMovingSlug("");
            moveVisibleMaterial(target.slug || target.id, movingSlug);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`确定删除「${pendingDelete?.title || ""}」吗？`}
        description="该操作会删除 content 中对应资料文件夹，前台也将不再显示。"
        busy={Boolean(pendingDelete) && deletingSlug === (pendingDelete?.slug || pendingDelete?.id)}
        onConfirm={() => void confirmDeleteMaterial()}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`确定删除选中的 ${selectedSlugs.length} 份资料吗？`}
        description="删除后无法恢复，对应资料文件及前台内容都会被移除。系统会逐份处理；如有删除失败，失败项会继续保留在选中列表中。"
        confirmText="确认批量删除"
        busy={bulkDeleting}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => {
          if (!bulkDeleting) setBulkDeleteOpen(false);
        }}
      />
    </main>
  );
}
