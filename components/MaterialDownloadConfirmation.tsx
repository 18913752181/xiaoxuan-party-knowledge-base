"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Material } from "@/lib/types";
import type { MaterialPointQuote } from "@/lib/material-point-view";
import { InsufficientPointsNotice } from "@/components/InsufficientPointsNotice";

export function MaterialDownloadConfirmation({ material, onConfirm, onClose }: {
  material: Material;
  onConfirm: (expectedPoints: number) => void;
  onClose: () => void;
}) {
  const [quote, setQuote] = useState<MaterialPointQuote | null>(null);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const slug = material.slug || material.id;
  useEffect(() => {
    const controller = new AbortController();
    setQuote(null); setError(""); setNeedsLogin(false);
    fetch("/api/material-points", {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
      body: JSON.stringify({ slugs: [slug], batch: false }), signal: controller.signal
    }).then(async (response) => {
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) { setNeedsLogin(response.status === 401); throw new Error(data.error || "暂时无法核验，请稍后重试。"); }
      setQuote(data);
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "暂时无法核验，请稍后重试。");
    });
    return () => controller.abort();
  }, [slug]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#302d28]/20 p-4" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="single-download-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#eadfc6] bg-white p-6 shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
      <p className="text-xs font-medium text-[#9a804e]">资料下载</p>
      <h2 id="single-download-title" className="mt-2 text-xl font-semibold text-brand-ink">确认下载</h2>
      <p className="mt-3 break-words text-sm leading-7 text-neutral-600">{material.title.replace(/^【小宣资料库】\s*/, "")}</p>
      {!quote && !error ? <p role="status" className="mt-4 text-sm text-neutral-500">正在核验积分和下载名额…</p> : null}
      {error ? <div role="alert" className="mt-4 text-sm leading-7 text-neutral-600"><p>{error}</p><Link href={needsLogin ? `/login?redirect=${encodeURIComponent(`/materials/${slug}`)}` : "/membership/payment"} className="text-[#80612e] underline underline-offset-4">{needsLogin ? "前往登录" : "查看会员权益"}</Link></div> : null}
      {quote ? <div className="mt-4 rounded-xl border border-[#efe4cc] bg-[#fffbf2] p-4 text-sm leading-7 text-[#796139]">
        <p className="font-semibold">本次需扣 {quote.requiredPoints} 积分，现有 {quote.pointsBalance} 积分</p>
        <p>{quote.legacyBenefits ? "原会员权益，免扣积分。" : quote.unlockedCount ? "已解锁，免费下载。" : "首次下载解锁后，再次下载不重复扣积分。"}</p>
        {quote.dailyLimit ? <p>本次占用 {quote.requestedNew} 个名额，今日剩余 {quote.dailyRemaining}/10。</p> : null}
      </div> : null}
      {quote && quote.shortfallPoints > 0 ? <InsufficientPointsNotice {...quote} /> : null}
      {quote?.dailyExceeded ? <p role="alert" className="mt-4 text-sm leading-7 text-[#80612e]">今日不同文件下载名额已用完，请明天再来。今日下载过的文件仍可重复下载。</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <button autoFocus type="button" onClick={onClose} className="min-h-11 rounded-xl border border-[#e8e4db] px-5 py-2.5 text-sm text-neutral-500 hover:bg-[#faf9f6]">取消</button>
        <button type="button" disabled={!quote || quote.shortfallPoints > 0 || quote.dailyExceeded} onClick={() => { if (quote) onConfirm(quote.requiredPoints); }} className="min-h-11 rounded-xl border border-[#e8d39c] bg-[#f7e8bd] px-5 py-2.5 text-sm font-medium text-[#755b2d] transition-colors hover:bg-[#f1dda7] disabled:cursor-not-allowed disabled:opacity-40">确认下载</button>
      </div>
    </section>
  </div>;
}
