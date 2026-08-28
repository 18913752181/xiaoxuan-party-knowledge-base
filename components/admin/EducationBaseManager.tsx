"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type EducationBase = {
  id: number;
  name: string;
  type: string;
  city: string;
  district: string;
  intro: string;
  status: string;
  icon: string;
  contact: string;
  source_url: string | null;
  has_guided_tour: boolean | null;
  guide_fee: string | null;
  guide_service_note: string | null;
  guide_source_url: string | null;
  guide_verified_at: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinate_type: "gcj02" | "wgs84" | null;
  location_source_name: string | null;
  location_source_url: string | null;
  location_confidence: "verified" | "probable" | "pending";
  sort_order: number;
  is_published: boolean;
  updated_at?: string;
};

type Draft = Omit<EducationBase, "id" | "updated_at"> & { id?: number };

const EMPTY_DRAFT: Draft = {
  name: "",
  type: "红色资源",
  city: "苏州市",
  district: "区县待确认",
  intro: "",
  status: "可联系",
  icon: "⌖",
  contact: "联系信息待核实",
  source_url: null,
  has_guided_tour: null,
  guide_fee: null,
  guide_service_note: null,
  guide_source_url: null,
  guide_verified_at: null,
  address: null,
  latitude: null,
  longitude: null,
  coordinate_type: "gcj02",
  location_source_name: null,
  location_source_url: null,
  location_confidence: "pending",
  sort_order: 0,
  is_published: false
};

const inputClass = "h-11 w-full rounded-xl border border-[#dcd5c9] bg-white px-3 text-sm outline-none transition focus:border-[#6f8f7e] focus:ring-2 focus:ring-[#6f8f7e]/15";
const textareaClass = "min-h-24 w-full rounded-xl border border-[#dcd5c9] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#6f8f7e] focus:ring-2 focus:ring-[#6f8f7e]/15";

function optional(value: string | null) {
  return value || "";
}

function numberValue(value: number | null) {
  return value === null ? "" : String(value);
}

function draftFrom(item: EducationBase): Draft {
  return { ...item };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium text-[#4f5852]">{label}</span>{hint ? <span className="ml-2 text-xs text-[#92978f]">{hint}</span> : null}<span className="mt-2 block">{children}</span></label>;
}

export default function EducationBaseManager() {
  const [items, setItems] = useState<EducationBase[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("全部城市");
  const [publication, setPublication] = useState("全部状态");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<EducationBase | null>(null);

  const load = useCallback(async (preferredId?: number) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/education-bases", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "读取失败");
      const bases = (payload.bases || []) as EducationBase[];
      setItems(bases);
      setDraft((currentDraft) => {
        if (preferredId) {
          const selected = bases.find((item) => item.id === preferredId);
          return selected ? draftFrom(selected) : currentDraft;
        }
        return !currentDraft.id && bases.length ? draftFrom(bases[0]) : currentDraft;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "读取失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const cities = useMemo(() => ["全部城市", ...Array.from(new Set(items.map((item) => item.city)))], [items]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !keyword || [item.name, item.type, item.city, item.district, item.address, item.intro].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      const matchesCity = city === "全部城市" || item.city === city;
      const matchesPublication = publication === "全部状态" || (publication === "已发布" ? item.is_published : !item.is_published);
      return matchesQuery && matchesCity && matchesPublication;
    });
  }, [items, query, city, publication]);

  const publishedCount = items.filter((item) => item.is_published).length;
  const locatedCount = items.filter((item) => item.latitude !== null && item.longitude !== null).length;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    const nextOrder = items.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;
    setDraft({ ...EMPTY_DRAFT, sort_order: nextOrder });
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/education-bases", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      const id = Number(payload.item?.id || draft.id);
      await load(id);
      setMessage(draft.id ? "基地资料已保存。" : "基地已新增。确认资料无误后可以发布。" );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function seedInitialData() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/education-bases/seed", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "导入失败");
      await load();
      setMessage(`已导入 ${payload.count || 0} 条现有基地。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/education-bases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "删除失败");
      setDeleteTarget(null);
      setDraft(EMPTY_DRAFT);
      await load();
      setMessage("基地记录已删除。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="基地数据概览">
        <div className="rounded-2xl border border-[#e3ddd2] bg-white p-5"><p className="text-2xl font-semibold">{items.length}</p><p className="mt-1 text-sm text-[#747b76]">全部基地</p></div>
        <div className="rounded-2xl border border-[#e3ddd2] bg-white p-5"><p className="text-2xl font-semibold">{publishedCount}</p><p className="mt-1 text-sm text-[#747b76]">已发布</p></div>
        <div className="rounded-2xl border border-[#e3ddd2] bg-white p-5"><p className="text-2xl font-semibold">{locatedCount}</p><p className="mt-1 text-sm text-[#747b76]">已有坐标</p></div>
      </section>

      {message ? <div className="mt-4 rounded-xl border border-[#ddd5c8] bg-white px-4 py-3 text-sm leading-6 text-[#59635d]" role="status">{message}</div> : null}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[#e3ddd2] bg-white p-4 lg:sticky lg:top-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">基地目录</h2><p className="mt-1 text-xs text-[#858b86]">当前显示 {filtered.length} 条</p></div>
            <button type="button" onClick={startCreate} className="h-10 rounded-xl bg-[#607d6d] px-4 text-sm font-medium text-white hover:bg-[#526f60]">新增基地</button>
          </div>
          <div className="mt-4 grid gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="搜索名称、地区或类型" />
            <div className="grid grid-cols-2 gap-2">
              <select value={city} onChange={(event) => setCity(event.target.value)} className={inputClass}>{cities.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={publication} onChange={(event) => setPublication(event.target.value)} className={inputClass}><option>全部状态</option><option>已发布</option><option>草稿</option></select>
            </div>
          </div>
          <div className="mt-3 max-h-[64vh] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="py-8 text-center text-sm text-[#858b86]">正在读取基地数据...</p> : null}
            {!loading && !items.length ? <div className="py-8 text-center"><p className="text-sm text-[#858b86]">数据库中还没有基地。</p><button type="button" disabled={saving} onClick={() => void seedInitialData()} className="mt-4 h-10 rounded-xl bg-[#607d6d] px-4 text-sm font-medium text-white disabled:opacity-50">导入现有 149 条</button></div> : null}
            {!loading && items.length > 0 && !filtered.length ? <p className="py-8 text-center text-sm text-[#858b86]">没有符合条件的基地。</p> : null}
            {filtered.map((item) => (
              <button key={item.id} type="button" onClick={() => setDraft(draftFrom(item))} className={`w-full rounded-xl border p-3 text-left transition ${draft.id === item.id ? "border-[#789686] bg-[#f0f5f1]" : "border-[#e8e2d8] bg-white hover:border-[#a9baaf]"}`}>
                <span className="flex items-start justify-between gap-3"><span className="font-medium leading-6 text-[#343b37]">{item.name}</span><span className={`shrink-0 text-xs ${item.is_published ? "text-[#547563]" : "text-[#9a7565]"}`}>{item.is_published ? "已发布" : "草稿"}</span></span>
                <span className="mt-1 block text-xs leading-5 text-[#858b86]">{item.city} / {item.district} / {item.type}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-[#e3ddd2] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-medium text-[#71847a]">{draft.id ? `记录 ${draft.id}` : "新记录"}</p><h2 className="mt-1 text-xl font-semibold">{draft.id ? "编辑基地" : "新增基地"}</h2></div>
            <div className="flex gap-2">
              {draft.id ? <button type="button" onClick={() => setDeleteTarget(items.find((item) => item.id === draft.id) || null)} className="h-10 rounded-xl border border-[#e4c9c9] px-4 text-sm text-[#a34850]">删除</button> : null}
              <button type="button" disabled={saving} onClick={() => void save()} className="h-10 rounded-xl bg-[#607d6d] px-5 text-sm font-medium text-white disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="基地名称"><input value={draft.name} onChange={(event) => update("name", event.target.value)} className={inputClass} /></Field>
              <Field label="基地类型"><input value={draft.type} onChange={(event) => update("type", event.target.value)} className={inputClass} placeholder="例如：红色资源" /></Field>
              <Field label="城市"><input value={draft.city} onChange={(event) => update("city", event.target.value)} className={inputClass} placeholder="例如：苏州市" /></Field>
              <Field label="区县"><input value={draft.district} onChange={(event) => update("district", event.target.value)} className={inputClass} placeholder="例如：姑苏区" /></Field>
              <Field label="联系状态"><input value={draft.status} onChange={(event) => update("status", event.target.value)} className={inputClass} /></Field>
              <Field label="排序"><input type="number" min="0" value={draft.sort_order} onChange={(event) => update("sort_order", Number(event.target.value) || 0)} className={inputClass} /></Field>
            </div>

            <Field label="基地简介"><textarea value={draft.intro} onChange={(event) => update("intro", event.target.value)} className={textareaClass} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="联系信息"><input value={draft.contact} onChange={(event) => update("contact", event.target.value)} className={inputClass} /></Field>
              <Field label="资料来源网址"><input type="url" value={optional(draft.source_url)} onChange={(event) => update("source_url", event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
            </div>

            <div className="border-t border-[#ece6dc] pt-5">
              <h3 className="font-semibold">讲解服务</h3>
              <p className="mt-1 text-xs leading-5 text-[#858b86]">没有可靠公开信息时请选择“尚未核实”并留空，不要根据免费参观推断免费讲解。</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="是否提供讲解"><select value={draft.has_guided_tour === null ? "unknown" : draft.has_guided_tour ? "yes" : "no"} onChange={(event) => update("has_guided_tour", event.target.value === "yes" ? true : event.target.value === "no" ? false : null)} className={inputClass}><option value="unknown">尚未核实</option><option value="yes">有讲解</option><option value="no">明确无讲解</option></select></Field>
                <Field label="讲解费用" hint="保留场馆公开口径"><input value={optional(draft.guide_fee)} onChange={(event) => update("guide_fee", event.target.value || null)} className={inputClass} placeholder="未查到时留空" /></Field>
                <Field label="核验日期"><input type="date" value={optional(draft.guide_verified_at)} onChange={(event) => update("guide_verified_at", event.target.value || null)} className={inputClass} /></Field>
                <Field label="讲解信息来源"><input type="url" value={optional(draft.guide_source_url)} onChange={(event) => update("guide_source_url", event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
              </div>
              <div className="mt-4"><Field label="讲解说明" hint="预约、场次、人数等"><textarea value={optional(draft.guide_service_note)} onChange={(event) => update("guide_service_note", event.target.value || null)} className={textareaClass} placeholder="未查到时留空" /></Field></div>
            </div>

            <div className="border-t border-[#ece6dc] pt-5">
              <h3 className="font-semibold">地图位置</h3>
              <p className="mt-1 text-xs leading-5 text-[#858b86]">经纬度必须同时填写。微信地图优先使用 GCJ-02 坐标。</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="详细地址"><input value={optional(draft.address)} onChange={(event) => update("address", event.target.value || null)} className={inputClass} /></Field>
                <Field label="坐标类型"><select value={draft.coordinate_type || ""} onChange={(event) => update("coordinate_type", event.target.value === "wgs84" ? "wgs84" : event.target.value === "gcj02" ? "gcj02" : null)} className={inputClass}><option value="">未填写</option><option value="gcj02">GCJ-02 高德或腾讯</option><option value="wgs84">WGS84</option></select></Field>
                <Field label="纬度"><input type="number" step="any" value={numberValue(draft.latitude)} onChange={(event) => update("latitude", event.target.value === "" ? null : Number(event.target.value))} className={inputClass} placeholder="31.2989" /></Field>
                <Field label="经度"><input type="number" step="any" value={numberValue(draft.longitude)} onChange={(event) => update("longitude", event.target.value === "" ? null : Number(event.target.value))} className={inputClass} placeholder="120.5853" /></Field>
                <Field label="位置可信度"><select value={draft.location_confidence} onChange={(event) => update("location_confidence", event.target.value as Draft["location_confidence"])} className={inputClass}><option value="verified">已核实</option><option value="probable">公开位置已匹配</option><option value="pending">待核实</option></select></Field>
                <Field label="位置来源名称"><input value={optional(draft.location_source_name)} onChange={(event) => update("location_source_name", event.target.value || null)} className={inputClass} placeholder="例如：高德地图" /></Field>
                <Field label="位置来源网址"><input type="url" value={optional(draft.location_source_url)} onChange={(event) => update("location_source_url", event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
              </div>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-xl border border-[#ddd6ca] bg-[#faf8f3] p-4">
              <span><span className="block text-sm font-medium">发布到小程序</span><span className="mt-1 block text-xs leading-5 text-[#858b86]">关闭后保存为草稿，不会出现在公开接口中。</span></span>
              <input type="checkbox" checked={draft.is_published} onChange={(event) => update("is_published", event.target.checked)} className="h-5 w-5 accent-[#607d6d]" />
            </label>
          </div>
        </section>
      </div>

      <ConfirmDialog open={Boolean(deleteTarget)} title={`确定删除“${deleteTarget?.name || ""}”吗？`} description="删除后无法从后台恢复。已经收藏该基地的用户将无法继续打开对应详情。" busy={saving} onConfirm={() => void remove()} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
