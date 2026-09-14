"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MaterialPreview as PreviewData } from "@/lib/material-preview";

export function MaterialPreview({ slug, title, standalone = false }: { slug: string; title: string; standalone?: boolean }) {
  const [open, setOpen] = useState(standalone);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const [data, setData] = useState<PreviewData | null>(null);
  const [pdf, setPdf] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let objectUrl = "";
    setLoading(true);
    setError("");
    setStatus(0);
    setData(null);
    setPdf("");
    async function load() {
      try {
        const response = await fetch(`/api/content-units/${encodeURIComponent(slug)}/preview`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) {
          const body = await response.json();
          if (controller.signal.aborted) return;
          setStatus(response.status);
          throw new Error(body.error || "预览加载失败。");
        }
        window.dispatchEvent(new Event("material-access-changed"));
        if (response.headers.get("content-type")?.includes("application/pdf")) {
          const blob = await response.blob();
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          setPdf(objectUrl);
        } else {
          const body = await response.json();
          if (!controller.signal.aborted) setData(body);
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "网络异常，请重试。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, slug, attempt]);

  return <section className="border-t border-brand-line py-6 first:border-t-0 first:pt-0">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold text-brand-ink">资料预览</h2>
      {!standalone && <button type="button" aria-expanded={open} aria-controls="material-preview-content" onClick={() => setOpen(!open)} className="rounded-xl border border-brand-line bg-white px-5 py-2.5 text-sm font-medium text-brand-red hover:bg-[#f8f7f4]">
        {open ? "收起预览" : "预览资料"}
      </button>}
    </div>
    {!open && <p className="mt-3 text-sm text-neutral-500">下载前先查看资料内容。</p>}
    {open && <div id="material-preview-content" className="mt-4" aria-busy={loading}>
      {loading && <p role="status" className="rounded-xl bg-[#f8f7f4] p-6 text-sm text-neutral-600">正在加载预览…</p>}
      {error && <div role="alert" className="rounded-xl bg-[#fffaf1] p-5 text-sm text-[#7a633f]">
        <p>{error}</p>
        <div className="mt-3 flex gap-4">
          {status === 401 ? <Link className="underline" href={`/login?redirect=${encodeURIComponent(`/materials/${encodeURIComponent(slug)}${standalone ? "/preview" : ""}`)}`}>前往登录</Link>
            : status === 403 ? <Link className="underline" href="/membership/payment">开通会员</Link>
            : <button type="button" onClick={() => setAttempt(attempt + 1)} className="underline">重新加载</button>}
        </div>
      </div>}
      {pdf && <>
        <p className="mb-3 text-sm text-neutral-500">若浏览器未显示页面，可<a href={pdf} target="_blank" rel="noreferrer" className="text-brand-red underline">在新窗口查看 PDF</a>，或下载原文件。</p>
        <iframe src={pdf} title={`${title} PDF 预览`} className="h-[65vh] min-h-[400px] w-full rounded-xl border border-brand-line bg-neutral-100" />
      </>}
      {data && <>
        <p className="mb-3 text-xs leading-6 text-neutral-500">{data.note}</p>
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-brand-line bg-[#faf9f6] p-4 md:p-6" tabIndex={0} aria-label="资料预览内容">
          {data.sections.map((section, index) => <section key={index} className="mb-5 rounded-lg border border-brand-line bg-white p-4 last:mb-0 md:p-6">
            <h3 className="mb-4 text-sm font-semibold text-brand-ink">{section.title}</h3>
            {data.kind === "table" ? <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><tbody>
              {section.rows?.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="min-w-[100px] max-w-[400px] whitespace-pre-wrap break-words border border-brand-line px-3 py-2 align-top">{cell}</td>)}</tr>)}
            </tbody></table>{!section.rows?.length && <p className="text-sm text-neutral-500">空白工作表。</p>}</div>
              : <p className="whitespace-pre-wrap break-words text-sm leading-8 text-neutral-700">{section.text || "此页没有可预览的文字，图片等内容请下载原文件查看。"}</p>}
          </section>)}
        </div>
      </>}
    </div>}
  </section>;
}
