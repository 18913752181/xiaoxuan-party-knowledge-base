"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Base = { id: number; name: string; type: string; city: string; district: string; address: string | null; latitude: number | null; longitude: number | null; location_confidence: string };
type Candidate = { id: number; candidate_rank: number; poi_name: string; address: string | null; latitude: number | null; longitude: number | null; city: string | null; district: string | null; poi_category: string | null; match_score: number; name_similarity: number; city_match: boolean; district_match: boolean; confidence_level: "high" | "medium" | "low"; is_reasonable_category: boolean };
type Review = { id: number; base_id: number; status: string; selected_candidate_id: number | null; last_error: string | null; searched_at: string; education_base_location_candidates: Candidate[] };

const inputClass = "h-10 w-full rounded-lg border border-[#dcd5c9] bg-white px-3 text-sm outline-none focus:border-[#6f8f7e] focus:ring-2 focus:ring-[#6f8f7e]/15";

function position(candidate: Candidate) {
  return candidate.latitude === null || candidate.longitude === null ? "坐标缺失" : `${candidate.latitude}, ${candidate.longitude}`;
}

function isLocationComplete(base: Base) {
  return Boolean(base.address && base.latitude !== null && base.longitude !== null);
}

const statusText: Record<string, string> = {
  auto_matched: "已自动匹配",
  needs_review: "待人工确认",
  not_found: "未找到",
  confirmed: "已人工确认",
  manual_confirmed: "已人工修订",
  failed: "检索失败"
};

const confidenceText = { high: "高", medium: "中", low: "低" };

export default function TencentLocationReview() {
  const [bases, setBases] = useState<Base[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [manual, setManual] = useState({ address: "", latitude: "", longitude: "" });
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/education-bases/tencent-location", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "无法读取核验数据。");
    setBases(payload.bases || []); setReviews(payload.reviews || []);
  }, []);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "无法读取核验数据。")); }, [load]);
  const targetBases = bases;
  const reviewByBase = useMemo(() => new Map(reviews.map((review) => [review.base_id, review])), [reviews]);
  const summary = useMemo(() => targetBases.reduce((result, base) => {
    const status = reviewByBase.get(base.id)?.status;
    if (status === "failed") result.failed += 1;
    else if (status === "not_found") result.notFound += 1;
    else if (isLocationComplete(base) && status) result.checkedExisting += 1;
    else if (status === "auto_matched") result.autoMatched += 1;
    else if (status === "needs_review") result.needsReview += 1;
    return result;
  }, { autoMatched: 0, checkedExisting: 0, needsReview: 0, notFound: 0, failed: 0 }), [reviewByBase, targetBases]);
  async function request(url: string, init: RequestInit) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "操作失败。");
      await load();
      return payload;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
      return null;
    } finally { setBusy(false); }
  }
  async function lookupAll() {
    if (!targetBases.length) { setMessage("数据库中没有可核验的基地。"); return; }
    setBusy(true); setMessage("");
    const total = { checkedExisting: 0, autoMatched: 0, needsReview: 0, notFound: 0, failed: 0 };
    try {
      for (let index = 0; index < targetBases.length; index += 5) {
        const batch = targetBases.slice(index, index + 5);
        const response = await fetch("/api/admin/education-bases/tencent-location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseIds: batch.map((base) => base.id) })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "批量核验失败。");
        Object.keys(total).forEach((key) => { total[key as keyof typeof total] += Number(payload.summary?.[key] || 0); });
        setMessage(`正在核验 ${Math.min(index + batch.length, targetBases.length)}/${targetBases.length}…`);
      }
      await load();
      setMessage(`处理完成：已有地址已对照 ${total.checkedExisting}，自动补齐 ${total.autoMatched}，缺失地址待确认 ${total.needsReview}，未找到 ${total.notFound}，失败 ${total.failed}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "批量核验失败。");
      await load().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  async function choose(baseId: number, candidate: Candidate) {
    await request("/api/admin/education-bases/tencent-location", { method: "PUT", body: JSON.stringify({ baseId, candidateId: candidate.id, action: "select" }) });
  }
  async function confirm(baseId: number, candidate: Candidate) {
    const payload = await request("/api/admin/education-bases/tencent-location", { method: "PUT", body: JSON.stringify({ baseId, candidateId: candidate.id, action: "confirm" }) });
    if (payload) setMessage("已确认并写入基地表。地图功能将读取该基地的 address、latitude、longitude。");
  }
  async function saveManual(baseId: number, candidate: Candidate) {
    const payload = await request("/api/admin/education-bases/tencent-location", { method: "PUT", body: JSON.stringify({ baseId, candidateId: candidate.id, action: "manual", manual }) });
    if (payload) { setEditing(null); setMessage("人工修订已保留腾讯 POI 候选留痕，并写入基地表。"); }
  }
  return <div className="mx-auto max-w-7xl">
    <section className="rounded-2xl border border-[#e3ddd2] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">腾讯地图地址核验</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#6d746f]">已有地址会调用腾讯位置服务进行对照，但不会覆盖；缺少地址或坐标时，只有唯一高置信度结果才自动补齐。每条保留前 5 个 POI 候选，系统每批处理 5 条。</p></div><button type="button" disabled={busy || !targetBases.length} onClick={() => void lookupAll()} className="h-10 rounded-xl bg-[#607d6d] px-4 text-sm font-medium text-white disabled:opacity-50">{busy ? "处理中..." : `核验全部基地（${targetBases.length}）`}</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-5">
        {[
          ["已有地址已对照", summary.checkedExisting],
          ["成功自动补齐", summary.autoMatched],
          ["缺失地址待确认", summary.needsReview],
          ["未找到", summary.notFound],
          ["检索失败", summary.failed]
        ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[#e8e1d6] bg-[#fcfbf8] px-4 py-3"><p className="text-xs text-[#7d857f]">{label}</p><p className="mt-1 text-2xl font-semibold text-[#36413b]">{value}</p></div>)}
      </div>
      {message ? <p role="status" className="mt-4 rounded-xl border border-[#ddd5c8] bg-[#faf8f3] px-4 py-3 text-sm text-[#59635d]">{message}</p> : null}
    </section>
    <section className="mt-5 space-y-4">
      {targetBases.map((base) => {
        const review = reviewByBase.get(base.id); const candidates = [...(review?.education_base_location_candidates || [])].sort((a, b) => a.candidate_rank - b.candidate_rank); const existingAwaitingCheck = isLocationComplete(base) && !review;
        const statusLabel = review?.status === "failed" ? "检索失败"
          : review?.status === "not_found" ? "腾讯未找到"
            : isLocationComplete(base) && review ? "已有地址已对照"
              : existingAwaitingCheck ? "已有地址待对照"
                : review ? (statusText[review.status] || review.status) : "未检索";
        return <article key={base.id} className="rounded-2xl border border-[#e3ddd2] bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-[#71847a]">{base.city} / {base.district} / {base.type}</p><h3 className="mt-1 text-lg font-semibold">{base.name}</h3><p className="mt-2 text-sm text-[#747b76]">当前地址：{base.address || "缺失"}　当前坐标：{base.latitude ?? "—"}, {base.longitude ?? "—"}</p></div><span className="rounded-full bg-[#f7f4ed] px-3 py-1 text-xs text-[#756e64]">{statusLabel}</span></div>
          {review?.last_error ? <p className="mt-4 rounded-lg bg-[#fff1ef] px-3 py-2 text-sm text-[#a14b43]">{review.last_error}</p> : null}
          {existingAwaitingCheck ? <p className="mt-4 rounded-xl bg-[#f2f7f3] px-4 py-3 text-sm text-[#567063]">已有完整位置数据；检索后会与腾讯候选对照，但不会覆盖现有内容。</p> : null}
          {!review && !existingAwaitingCheck ? <p className="mt-4 text-sm text-[#858b86]">尚未调用腾讯位置服务。</p> : null}
          {review && !candidates.length && !review.last_error ? <p className="mt-4 text-sm text-[#858b86]">腾讯位置服务未返回候选结果。</p> : null}
          {candidates.length ? <div className="mt-5 overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="border-b border-[#ece6dc] text-xs text-[#7d857e]"><tr><th className="pb-3 pr-3">候选</th><th className="pb-3 pr-3">腾讯候选名称 / 地址</th><th className="pb-3 pr-3">经纬度</th><th className="pb-3 pr-3">城市 / 区县</th><th className="pb-3 pr-3">POI 类别</th><th className="pb-3 pr-3">匹配置信度</th><th className="pb-3">操作</th></tr></thead><tbody>{candidates.map((candidate) => <tr key={candidate.id} className={`border-b border-[#f0ece4] align-top ${review?.selected_candidate_id === candidate.id ? "bg-[#f2f7f3]" : ""}`}><td className="py-4 pr-3 text-[#7c857e]">#{candidate.candidate_rank}</td><td className="py-4 pr-3"><p className="font-medium text-[#343b37]">{candidate.poi_name}</p><p className="mt-1 max-w-sm leading-5 text-[#6f7771]">{candidate.address || "地址缺失"}</p></td><td className="py-4 pr-3 whitespace-nowrap text-[#59635d]">{position(candidate)}</td><td className="py-4 pr-3 whitespace-nowrap text-[#59635d]">{candidate.city || "—"} / {candidate.district || "—"}</td><td className="py-4 pr-3 text-[#59635d]">{candidate.poi_category || "—"}</td><td className="py-4 pr-3"><p><b className="text-[#416b52]">{candidate.match_score}</b><span className="ml-2 rounded-full bg-[#eef4ef] px-2 py-0.5 text-xs text-[#4e6a59]">{confidenceText[candidate.confidence_level]}置信度</span></p><p className="mt-1 text-xs text-[#89908b]">名称 {Math.round(candidate.name_similarity * 100)}% · 城市{candidate.city_match ? "一致" : "不一致"} · 区县{candidate.district_match ? "一致" : "不一致"} · 类别{candidate.is_reasonable_category ? "合理" : "待核"}</p></td><td className="py-4"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void choose(base.id, candidate)} className="rounded-lg border border-[#d8d2c8] px-3 py-1.5 text-xs">换这个候选</button><button type="button" disabled={busy} onClick={() => void confirm(base.id, candidate)} className="rounded-lg bg-[#607d6d] px-3 py-1.5 text-xs text-white">确认</button><button type="button" disabled={busy} onClick={() => { setEditing(candidate.id); setManual({ address: candidate.address || "", latitude: String(candidate.latitude ?? ""), longitude: String(candidate.longitude ?? "") }); }} className="rounded-lg border border-[#d8d2c8] px-3 py-1.5 text-xs">手动修改</button></div>{editing === candidate.id ? <div className="mt-3 grid w-72 gap-2"><input aria-label="地址" className={inputClass} value={manual.address} onChange={(event) => setManual((value) => ({ ...value, address: event.target.value }))} /><div className="grid grid-cols-2 gap-2"><input aria-label="纬度" className={inputClass} value={manual.latitude} onChange={(event) => setManual((value) => ({ ...value, latitude: event.target.value }))} /><input aria-label="经度" className={inputClass} value={manual.longitude} onChange={(event) => setManual((value) => ({ ...value, longitude: event.target.value }))} /></div><button type="button" disabled={busy} onClick={() => void saveManual(base.id, candidate)} className="rounded-lg bg-[#866d4d] px-3 py-2 text-xs text-white">保存人工修订</button></div> : null}</td></tr>)}</tbody></table></div> : null}
        </article>;
      })}
    </section>
  </div>;
}
