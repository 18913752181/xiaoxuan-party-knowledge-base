"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import DimmoExpressionPreview from "@/components/DimmoExpressionPreview";
import { DIMMO_SPRITE_SHEET_V2, DIMMO_SPRITE_SHEETS, type DimmoExpressionRow, type DimmoForm } from "@/lib/dimmo-expressions";

type Draft = Omit<DimmoExpressionRow, "id" | "created_at" | "updated_at"> & { id?: number };

const EMPTY_DRAFT: Draft = {
  name: "",
  slug: "",
  form: "adult",
  image_url: null,
  storage_path: null,
  sprite_sheet_url: DIMMO_SPRITE_SHEET_V2,
  sprite_row: 0,
  sprite_col: 0,
  alt_text: "",
  tags: [],
  usage_note: "",
  sort_order: 0,
  is_published: false
};

const inputClass = "h-11 w-full rounded-xl border border-[#ddd6ca] bg-white px-3 text-sm outline-none transition focus:border-[#6f8f7e] focus:ring-2 focus:ring-[#6f8f7e]/15";
const textareaClass = "min-h-24 w-full rounded-xl border border-[#ddd6ca] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#6f8f7e] focus:ring-2 focus:ring-[#6f8f7e]/15";

function draftFrom(item: DimmoExpressionRow): Draft {
  return { ...item };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium text-[#4f5852]">{label}</span>{hint ? <span className="ml-2 text-xs text-[#92978f]">{hint}</span> : null}<span className="mt-2 block">{children}</span></label>;
}

function formName(form: DimmoForm) {
  return form === "coalball" ? "煤球小黑猫" : "成年 Dimmo";
}

export default function DimmoExpressionManager() {
  const [items, setItems] = useState<DimmoExpressionRow[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [formFilter, setFormFilter] = useState<"all" | DimmoForm>("all");
  const [publication, setPublication] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DimmoExpressionRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkPublication, setBulkPublication] = useState<"keep" | "published" | "draft">("keep");
  const [bulkForm, setBulkForm] = useState<"keep" | DimmoForm>("keep");
  const [bulkTags, setBulkTags] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async (preferredId?: number) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/dimmo-expressions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取失败");
      const expressions = (payload.expressions || []) as DimmoExpressionRow[];
      setItems(expressions);
      setSelectedIds((current) => current.filter((id) => expressions.some((item) => item.id === id)));
      setDraft((current) => {
        if (preferredId) return draftFrom(expressions.find((item) => item.id === preferredId) || current as DimmoExpressionRow);
        if (!current.id && expressions.length) return draftFrom(expressions[0]);
        return current;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !keyword || [item.name, item.slug, item.usage_note, ...item.tags].join(" ").toLowerCase().includes(keyword);
      const matchesForm = formFilter === "all" || item.form === formFilter;
      const matchesPublication = publication === "all" || (publication === "published" ? item.is_published : !item.is_published);
      return matchesQuery && matchesForm && matchesPublication;
    });
  }, [items, query, formFilter, publication]);

  const counts = useMemo(() => ({
    total: items.length,
    adult: items.filter((item) => item.form === "adult").length,
    coalball: items.filter((item) => item.form === "coalball").length,
    published: items.filter((item) => item.is_published).length
  }), [items]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selectedIds.includes(item.id));

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    const nextOrder = items.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
    setDraft({ ...EMPTY_DRAFT, sort_order: nextOrder });
    setMessage("");
  }

  function useSpriteSheet() {
    setDraft((current) => ({ ...current, image_url: null, storage_path: null, sprite_sheet_url: current.sprite_sheet_url || DIMMO_SPRITE_SHEET_V2, sprite_row: current.sprite_row ?? 0, sprite_col: current.sprite_col ?? 0 }));
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("slug", draft.slug || "dimmo-expression");
      const response = await fetch("/api/admin/dimmo-expressions/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "上传失败");
      setDraft((current) => ({ ...current, image_url: payload.imageUrl, storage_path: payload.storagePath, sprite_sheet_url: null, sprite_row: null, sprite_col: null }));
      setMessage("图片已上传，点击保存后正式生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/dimmo-expressions", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      const id = Number(payload.item?.id || draft.id);
      await load(id);
      setMessage(draft.id ? "表情状态已保存。" : "新表情已加入表情库。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/dimmo-expressions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "删除失败");
      setDeleteTarget(null);
      setDraft(EMPTY_DRAFT);
      await load();
      setMessage("表情已删除。独立上传的图片也已从存储中清理。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleFilteredSelection() {
    const filteredIds = filtered.map((item) => item.id);
    setSelectedIds((current) => {
      if (allFilteredSelected) return current.filter((id) => !filteredIds.includes(id));
      return Array.from(new Set([...current, ...filteredIds]));
    });
  }

  async function applyBulkEdit() {
    const tagsToAdd = bulkTags.split(/[,，]/).map((value) => value.trim()).filter(Boolean);
    if (!selectedIds.length) return;
    if (bulkPublication === "keep" && bulkForm === "keep" && !tagsToAdd.length) {
      setMessage("请先选择一项要批量修改的内容。");
      return;
    }

    const selected = items.filter((item) => selectedIds.includes(item.id));
    setSaving(true);
    setMessage(`正在批量保存 ${selected.length} 个表情…`);
    try {
      for (const item of selected) {
        const next = {
          ...item,
          form: bulkForm === "keep" ? item.form : bulkForm,
          is_published: bulkPublication === "keep" ? item.is_published : bulkPublication === "published",
          tags: tagsToAdd.length ? Array.from(new Set([...item.tags, ...tagsToAdd])) : item.tags
        };
        const response = await fetch("/api/admin/dimmo-expressions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next)
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(`${item.name}：${payload.error || "保存失败"}`);
      }
      const count = selected.length;
      setSelectedIds([]);
      setBulkPublication("keep");
      setBulkForm("keep");
      setBulkTags("");
      await load(draft.id);
      setMessage(`已批量更新 ${count} 个表情。`);
    } catch (error) {
      const failure = error instanceof Error ? `批量编辑未全部完成：${error.message}` : "批量编辑失败";
      await load(draft.id);
      setMessage(failure);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="表情库概览">
        {[[counts.total, "全部状态"], [counts.adult, "成年 Dimmo"], [counts.coalball, "煤球小黑猫"], [counts.published, "已发布"]].map(([value, label]) => (
          <div key={String(label)} className="rounded-2xl border border-[#e3ddd2] bg-white p-5"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-[#747b76]">{label}</p></div>
        ))}
      </section>

      {message ? <div className="mt-4 rounded-xl border border-[#ddd5c8] bg-white px-4 py-3 text-sm leading-6 text-[#59635d]" role="status">{message}</div> : null}

      {selectedIds.length ? (
        <section className="mt-4 rounded-2xl border border-[#cfdacf] bg-[#f3f7f3] p-4 sm:p-5" aria-label="批量编辑表情">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-semibold text-[#35443b]">批量编辑</h2><p className="mt-1 text-xs text-[#718077]">已选择 {selectedIds.length} 个表情；未设置的字段会保持原样。</p></div>
            <button type="button" onClick={() => setSelectedIds([])} className="h-9 rounded-lg border border-[#cad4cc] bg-white px-3 text-sm text-[#5f6c64]">清空选择</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto]">
            <select value={bulkPublication} onChange={(event) => setBulkPublication(event.target.value as "keep" | "published" | "draft")} className={inputClass} aria-label="批量发布状态"><option value="keep">发布状态不变</option><option value="published">设为已发布</option><option value="draft">设为草稿</option></select>
            <select value={bulkForm} onChange={(event) => setBulkForm(event.target.value as "keep" | DimmoForm)} className={inputClass} aria-label="批量角色形态"><option value="keep">角色形态不变</option><option value="adult">设为成年 Dimmo</option><option value="coalball">设为煤球小黑猫</option></select>
            <input value={bulkTags} onChange={(event) => setBulkTags(event.target.value)} className={inputClass} placeholder="追加标签，用逗号分隔" aria-label="批量追加标签" />
            <button type="button" disabled={saving} onClick={() => void applyBulkEdit()} className="h-11 rounded-xl bg-[#607d6d] px-5 text-sm font-medium text-white disabled:opacity-50">{saving ? "保存中…" : "应用修改"}</button>
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#e3ddd2] bg-white p-4 lg:sticky lg:top-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">表情目录</h2><p className="mt-1 text-xs text-[#858b86]">显示 {filtered.length} / {items.length} 个</p></div>
            <button type="button" onClick={startCreate} className="h-10 rounded-xl bg-[#607d6d] px-4 text-sm font-medium text-white">新增表情</button>
          </div>
          <div className="mt-4 grid gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="搜索名称、标签或用途" />
            <div className="grid grid-cols-2 gap-2">
              <select value={formFilter} onChange={(event) => setFormFilter(event.target.value as "all" | DimmoForm)} className={inputClass}><option value="all">全部形态</option><option value="adult">成年 Dimmo</option><option value="coalball">煤球小黑猫</option></select>
              <select value={publication} onChange={(event) => setPublication(event.target.value)} className={inputClass}><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option></select>
            </div>
            <div className="flex items-center justify-between gap-2 px-1 pt-1">
              <button type="button" disabled={!filtered.length} onClick={toggleFilteredSelection} className="text-xs font-medium text-[#607d6d] disabled:text-[#a4aaa6]">{allFilteredSelected ? "取消选择当前结果" : "选择当前全部结果"}</button>
              <span className="text-xs text-[#92978f]">已选 {selectedIds.length}</span>
            </div>
          </div>
          <div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="py-8 text-center text-sm text-[#858b86]">Dimmo 正在翻表情册…</p> : null}
            {!loading && !filtered.length ? <p className="py-8 text-center text-sm text-[#858b86]">没有符合条件的表情。</p> : null}
            {filtered.map((item) => (
              <div key={item.id} className={`flex items-center gap-2 rounded-xl border p-2 transition ${selectedIds.includes(item.id) ? "border-[#789686] bg-[#edf4ef]" : draft.id === item.id ? "border-[#a9baaf] bg-[#f7f9f7]" : "border-[#e8e2d8] hover:border-[#a9baaf]"}`}>
                <label className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center" title={`选择${item.name}`}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} className="h-4 w-4 accent-[#607d6d]" /><span className="sr-only">选择 {item.name}</span></label>
                <button type="button" onClick={() => setDraft(draftFrom(item))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#ece7de] bg-white"><DimmoExpressionPreview item={item} /></span>
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-[#343b37]">{item.name}</b><small className={item.is_published ? "text-[#547563]" : "text-[#9a7565]"}>{item.is_published ? "已发布" : "草稿"}</small></span><span className="mt-1 block text-xs text-[#858b86]">{formName(item.form)} · {item.slug}</span></span>
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#e3ddd2] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-medium text-[#71847a]">{draft.id ? `状态 ${draft.id}` : "新状态"}</p><h2 className="mt-1 text-xl font-semibold">{draft.id ? "编辑 Dimmo 表情" : "新增 Dimmo 表情"}</h2></div>
            <div className="flex gap-2">{draft.id ? <button type="button" onClick={() => setDeleteTarget(items.find((item) => item.id === draft.id) || null)} className="h-10 rounded-xl border border-[#e4c9c9] px-4 text-sm text-[#a34850]">删除</button> : null}<button type="button" disabled={saving || uploading} onClick={() => void save()} className="h-10 rounded-xl bg-[#607d6d] px-5 text-sm font-medium text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button></div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              <div className="aspect-square overflow-hidden rounded-[28px] border border-[#e5dfd5] bg-[#faf8f3] shadow-sm"><DimmoExpressionPreview item={draft} /></div>
              <p className="mt-3 text-center text-xs leading-5 text-[#858b86]">{draft.image_url ? "独立图片" : "角色总表取格"}</p>
              <input ref={fileInput} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
              <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="mt-3 h-10 w-full rounded-xl bg-[#2f3732] text-sm font-medium text-white disabled:opacity-50">{uploading ? "上传中…" : "上传独立图片"}</button>
              <button type="button" onClick={useSpriteSheet} className="mt-2 h-10 w-full rounded-xl border border-[#ddd6ca] text-sm text-[#59635d]">改用角色总表</button>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="表情名称"><input value={draft.name} onChange={(event) => update("name", event.target.value)} className={inputClass} placeholder="例如：温柔提醒" /></Field>
                <Field label="英文标识" hint="保存后仍可修改"><input value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} className={inputClass} placeholder="gentle-reminder" /></Field>
                <Field label="角色形态"><select value={draft.form} onChange={(event) => update("form", event.target.value as DimmoForm)} className={inputClass}><option value="adult">成年 Dimmo</option><option value="coalball">煤球小黑猫</option></select></Field>
                <Field label="排序"><input type="number" min="0" value={draft.sort_order} onChange={(event) => update("sort_order", Number(event.target.value) || 0)} className={inputClass} /></Field>
              </div>
              <Field label="使用场景"><textarea value={draft.usage_note} onChange={(event) => update("usage_note", event.target.value)} className={textareaClass} placeholder="这个状态适合在什么情况下出现？" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="标签" hint="用逗号分隔"><input value={draft.tags.join("，")} onChange={(event) => update("tags", event.target.value.split(/[,，]/).map((value) => value.trim()).filter(Boolean))} className={inputClass} placeholder="开心，欢迎" /></Field>
                <Field label="无障碍描述"><input value={draft.alt_text} onChange={(event) => update("alt_text", event.target.value)} className={inputClass} /></Field>
              </div>

              <div className="rounded-2xl border border-[#e8e1d5] bg-[#faf8f3] p-4">
                <div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">图片来源</h3><p className="mt-1 text-xs leading-5 text-[#858b86]">上传图优先；未上传时从 5×5 角色总表取格。</p></div><span className="rounded-full bg-white px-3 py-1 text-xs text-[#6d766f]">{draft.image_url ? "独立素材" : "总表素材"}</span></div>
                {draft.image_url ? <Field label="图片网址"><input value={draft.image_url} onChange={(event) => update("image_url", event.target.value || null)} className={inputClass} /></Field> : <div className="mt-4 grid gap-4"><Field label="角色总表"><select value={draft.sprite_sheet_url || DIMMO_SPRITE_SHEET_V2} onChange={(event) => update("sprite_sheet_url", event.target.value)} className={inputClass}>{DIMMO_SPRITE_SHEETS.map((sheet) => <option key={sheet.value} value={sheet.value}>{sheet.label}</option>)}</select></Field><div className="grid grid-cols-2 gap-4"><Field label="总表行（0–4）"><input type="number" min="0" max="4" value={draft.sprite_row ?? 0} onChange={(event) => update("sprite_row", Math.min(4, Math.max(0, Number(event.target.value) || 0)))} className={inputClass} /></Field><Field label="总表列（0–4）"><input type="number" min="0" max="4" value={draft.sprite_col ?? 0} onChange={(event) => update("sprite_col", Math.min(4, Math.max(0, Number(event.target.value) || 0)))} className={inputClass} /></Field></div></div>}
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-[#ddd6ca] bg-[#faf8f3] p-4"><span><span className="block text-sm font-medium">标记为可调用</span><span className="mt-1 block text-xs leading-5 text-[#858b86]">仅供后台记录。当前不会出现在任何前台页面，后续接入具体场景时再读取。</span></span><input type="checkbox" checked={draft.is_published} onChange={(event) => update("is_published", event.target.checked)} className="h-5 w-5 accent-[#607d6d]" /></label>
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog open={Boolean(deleteTarget)} title={`确定删除“${deleteTarget?.name || ""}”吗？`} description="删除记录后无法恢复；独立上传的图片也会一并清理。角色总表不会受影响。" busy={saving} onConfirm={() => void remove()} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
