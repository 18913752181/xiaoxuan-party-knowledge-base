"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  image_url: string | null;
  image_storage_path: string | null;
  image_alt: string | null;
  image_source_url: string | null;
  image_rights_status: "owned" | "licensed" | "reference-only" | "unknown" | null;
  has_guided_tour: boolean | null;
  guide_fee: string | null;
  guide_service_note: string | null;
  guide_source_url: string | null;
  guide_verified_at: string | null;
  opening_info: string | null;
  reservation_info: string | null;
  activity_formats: string | null;
  suitable_audiences: string | null;
  activity_route: string | null;
  nearby_base_combinations: string | null;
  activity_plan: string | null;
  related_materials: string | null;
  usage_tips: string | null;
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
  image_url: null,
  image_storage_path: null,
  image_alt: null,
  image_source_url: null,
  image_rights_status: "unknown",
  has_guided_tour: null,
  guide_fee: null,
  guide_service_note: null,
  guide_source_url: null,
  guide_verified_at: null,
  opening_info: null,
  reservation_info: null,
  activity_formats: null,
  suitable_audiences: null,
  activity_route: null,
  nearby_base_combinations: null,
  activity_plan: null,
  related_materials: null,
  usage_tips: null,
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

type RoutePart = "halfDay" | "fullDay";
type RouteEntry = { time?: string; title: string; note?: string; baseId?: number };

function jsonValue(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function routePlan(value: string | null) {
  const parsed = jsonValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { halfDay: [] as RouteEntry[], fullDay: [] as RouteEntry[], note: typeof parsed === "string" ? parsed : "" };
  const record = parsed as Record<string, unknown>;
  return {
    halfDay: Array.isArray(record.halfDay) ? record.halfDay as RouteEntry[] : [],
    fullDay: Array.isArray(record.fullDay) ? record.fullDay as RouteEntry[] : [],
    note: typeof record.note === "string" ? record.note : ""
  };
}

function routePartText(value: string | null, part: RoutePart) {
  return routePlan(value)[part].map((item) => [item.time || "", item.title || "", item.note || "", item.baseId || ""].join("｜").replace(/[｜]+$/, "")).join("\n");
}

function updateRoutePart(value: string | null, part: RoutePart, content: string) {
  const plan = routePlan(value);
  plan[part] = content.split(/\r?\n/).map((line) => {
    const [time = "", title = "", note = "", baseId = ""] = line.split(/[|｜]/).map((item) => item.trim());
    const id = Number(baseId);
    return { ...(time ? { time } : {}), title: title || time, ...(note ? { note } : {}), ...(Number.isInteger(id) && id > 0 ? { baseId: id } : {}) };
  }).filter((item) => item.title);
  return plan.halfDay.length || plan.fullDay.length || plan.note ? JSON.stringify(plan) : null;
}

function nearbyText(value: string | null) {
  const parsed = jsonValue(value);
  if (!Array.isArray(parsed)) return typeof parsed === "string" ? parsed : "";
  return parsed.map((entry) => {
    const item: Record<string, unknown> = typeof entry === "object" && entry ? entry as Record<string, unknown> : { baseId: entry };
    return [item.baseId || item.id || "", item.note || ""].join("｜").replace(/[｜]+$/, "");
  }).filter(Boolean).join("\n");
}

function updateNearby(content: string) {
  const items = content.split(/\r?\n/).map((line) => {
    const [baseId = "", note = ""] = line.split(/[|｜]/).map((item) => item.trim());
    const id = Number(baseId);
    return Number.isInteger(id) && id > 0 ? { baseId: id, ...(note ? { note } : {}) } : null;
  }).filter(Boolean);
  return items.length ? JSON.stringify(items) : null;
}

function materialsText(value: string | null) {
  const parsed = jsonValue(value);
  if (!Array.isArray(parsed)) return typeof parsed === "string" ? parsed : "";
  return parsed.map((entry) => {
    if (!entry || typeof entry !== "object") return "";
    const item = entry as Record<string, unknown>;
    return [item.title || item.name || "", item.url || "", item.description || item.note || ""].join("｜").replace(/[｜]+$/, "");
  }).filter(Boolean).join("\n");
}

function updateMaterials(content: string) {
  const items = content.split(/\r?\n/).map((line) => {
    const [title = "", url = "", description = ""] = line.split(/[|｜]/).map((item) => item.trim());
    return title && /^https:\/\/(?:www\.)?xiaoxuanvip\.com(?:\/|$)/i.test(url) ? { title, url, ...(description ? { description } : {}) } : null;
  }).filter(Boolean);
  return items.length ? JSON.stringify(items) : null;
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
  const [uploadingImage, setUploadingImage] = useState(false);
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

  async function uploadImage(file?: File) {
    if (!file) return;
    setUploadingImage(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("baseId", String(draft.id || "new"));
      const response = await fetch("/api/admin/education-bases/upload", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "上传失败");
      setDraft((current) => ({
        ...current,
        image_url: payload.imageUrl,
        image_storage_path: payload.storagePath,
        image_alt: current.image_alt || (current.name ? `${current.name}配图` : "教育基地配图")
      }));
      setMessage("图片已上传，请点击“保存”将它绑定到当前基地。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploadingImage(false);
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
            <div className="border-t border-[#ece6dc] pt-5">
              <h3 className="font-semibold">基地配图</h3>
              <p className="mt-1 text-xs leading-5 text-[#858b86]">上传后还需要点击页面右上角“保存”。建议使用横向插图，PNG、WebP 或 JPG，单张不超过 6MB。</p>
              <div className="mt-4 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-2xl border border-[#e4ddd1] bg-[#f8f4eb]">
                  {draft.image_url ? <div className="relative aspect-[4/3]"><Image src={draft.image_url} alt={draft.image_alt || draft.name || "基地配图预览"} fill sizes="220px" className="object-contain" unoptimized /></div> : <div className="flex aspect-[4/3] items-center justify-center px-5 text-center text-sm text-[#96958e]">暂未配置配图</div>}
                  <div className="flex gap-2 border-t border-[#e4ddd1] bg-white p-3">
                    <label className="flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl bg-[#f4cf66] px-3 text-sm font-medium text-[#332d24]">
                      {uploadingImage ? "上传中..." : draft.image_url ? "更换图片" : "上传图片"}
                      <input type="file" accept="image/png,image/webp,image/jpeg" disabled={uploadingImage} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadImage(file); }} className="sr-only" />
                    </label>
                    {draft.image_url ? <button type="button" onClick={() => setDraft((current) => ({ ...current, image_url: null, image_storage_path: null }))} className="h-10 rounded-xl border border-[#e1d8ca] px-3 text-sm text-[#766b5c]">清除</button> : null}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Field label="图片网址" hint="也可以直接粘贴现有图片地址"><input value={optional(draft.image_url)} onChange={(event) => update("image_url", event.target.value || null)} className={inputClass} placeholder="https:// 或 /images/..." /></Field></div>
                  <div className="sm:col-span-2"><Field label="图片说明"><input value={optional(draft.image_alt)} onChange={(event) => update("image_alt", event.target.value || null)} className={inputClass} placeholder="例如：苏州市规划展示馆建筑插画" /></Field></div>
                  <Field label="图片来源网址"><input type="url" value={optional(draft.image_source_url)} onChange={(event) => update("image_source_url", event.target.value || null)} className={inputClass} placeholder="没有来源页面时留空" /></Field>
                  <Field label="图片权利状态"><select value={draft.image_rights_status || "unknown"} onChange={(event) => update("image_rights_status", event.target.value as Draft["image_rights_status"])} className={inputClass}><option value="unknown">尚未确认</option><option value="owned">自有图片</option><option value="licensed">已获授权</option><option value="reference-only">仅作设计参考</option></select></Field>
                </div>
              </div>
            </div>

            <div className="border-t border-[#ece6dc] pt-5">
              <h3 className="font-semibold">教育基地攻略（会员内容）</h3>
              <p className="mt-1 text-xs leading-5 text-[#858b86]">事实信息必须经过核实；路线和使用提示属于“宣知整理建议”。不知道时留空，小程序统一显示“待完善”。</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="经核实的联系方式"><input value={draft.contact} onChange={(event) => update("contact", event.target.value)} className={inputClass} placeholder="未知时填写：联系信息待核实" /></Field>
                <Field label="官方来源网址"><input type="url" value={optional(draft.source_url)} onChange={(event) => update("source_url", event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
                <Field label="开放信息"><textarea value={optional(draft.opening_info)} onChange={(event) => update("opening_info", event.target.value || null)} className={textareaClass} placeholder="开放日期、时段、临时闭馆规则等" /></Field>
                <Field label="预约信息"><textarea value={optional(draft.reservation_info)} onChange={(event) => update("reservation_info", event.target.value || null)} className={textareaClass} placeholder="预约渠道、提前时间、团队人数等" /></Field>
                <Field label="是否提供讲解"><select value={draft.has_guided_tour === null ? "unknown" : draft.has_guided_tour ? "yes" : "no"} onChange={(event) => update("has_guided_tour", event.target.value === "yes" ? true : event.target.value === "no" ? false : null)} className={inputClass}><option value="unknown">尚未核实</option><option value="yes">有讲解</option><option value="no">明确无讲解</option></select></Field>
                <Field label="讲解费用" hint="保留场馆公开口径"><input value={optional(draft.guide_fee)} onChange={(event) => update("guide_fee", event.target.value || null)} className={inputClass} placeholder="未查到时留空" /></Field>
                <Field label="核验日期"><input type="date" value={optional(draft.guide_verified_at)} onChange={(event) => update("guide_verified_at", event.target.value || null)} className={inputClass} /></Field>
                <Field label="讲解信息来源"><input type="url" value={optional(draft.guide_source_url)} onChange={(event) => update("guide_source_url", event.target.value || null)} className={inputClass} placeholder="https://" /></Field>
              </div>
              <div className="mt-4"><Field label="讲解说明" hint="预约、场次、人数等"><textarea value={optional(draft.guide_service_note)} onChange={(event) => update("guide_service_note", event.target.value || null)} className={textareaClass} placeholder="未查到时留空" /></Field></div>
              <div className="mt-5 border-t border-[#eee8dc] pt-5"><p className="text-sm font-semibold text-[#4f5852]">活动路线 <span className="ml-2 text-xs font-normal text-[#9a7b2d]">宣知整理建议</span></p><p className="mt-1 text-xs leading-5 text-[#858b86]">每行格式：时间｜节点名称｜简短说明｜关联基地ID。没有的部分可以留空。</p></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="半日路线"><textarea value={routePartText(draft.activity_route, "halfDay")} onChange={(event) => update("activity_route", updateRoutePart(draft.activity_route, "halfDay", event.target.value))} className={textareaClass} placeholder="09:00｜基地参观｜建议提前到场｜14" /></Field>
                <Field label="一日路线"><textarea value={routePartText(draft.activity_route, "fullDay")} onChange={(event) => update("activity_route", updateRoutePart(draft.activity_route, "fullDay", event.target.value))} className={textareaClass} placeholder="09:00｜上午教学｜核对开放时间｜14" /></Field>
                <Field label="周边联动基地" hint="填写数据库中的基地ID"><textarea value={nearbyText(draft.nearby_base_combinations)} onChange={(event) => update("nearby_base_combinations", updateNearby(event.target.value))} className={textareaClass} placeholder="14｜步行可达，适合联动" /></Field>
                <Field label="配套方案与资料" hint="只关联小宣资料库"><textarea value={materialsText(draft.related_materials)} onChange={(event) => update("related_materials", updateMaterials(event.target.value))} className={textareaClass} placeholder="主题党日活动方案｜https://xiaoxuanvip.com/materials/...｜方案说明" /></Field>
              </div>
              <div className="mt-4"><Field label="基地使用提示" hint="宣知整理建议，最多5条，每行1条"><textarea value={optional(draft.usage_tips)} onChange={(event) => update("usage_tips", event.target.value || null)} className={textareaClass} placeholder={'建议提前预约\n适合团队活动\n可安排半日'} /></Field></div>
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
