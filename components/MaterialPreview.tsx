"use client";
/* eslint-disable @next/next/no-img-element -- Preview pages are in-memory Canvas scans, not network images. */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ScanPage = { src: string; width: number; height: number };

const PAGE_WIDTH = 1240;

async function rasterPdf(buffer: ArrayBuffer, onProgress: (pages: ScanPage[], total: number) => void) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
  const documentProxy = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: ScanPage[] = [];
  for (let index = 1; index <= documentProxy.numPages; index += 1) {
    const pdfPage = await documentProxy.getPage(index);
    const base = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({ scale: Math.min(2, PAGE_WIDTH / base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器无法创建 PDF 预览画布。");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: context, viewport }).promise;
    pages.push({ src: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height });
    onProgress([...pages], documentProxy.numPages);
  }
  return { pages, total: documentProxy.numPages };
}

export function MaterialPreview({ slug, title, standalone = false }: { slug: string; title: string; standalone?: boolean }) {
  const [open, setOpen] = useState(standalone);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(0);
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [note, setNote] = useState("");
  const [zoom, setZoom] = useState(1);
  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setStatus(0);
    setPages([]);
    setTotalPages(0);
    setNote("");
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
        if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("预览文件格式异常，请重新加载。");
        const result = await rasterPdf(await response.arrayBuffer(), (next, total) => {
          if (!controller.signal.aborted) {
            setPages(next);
            setTotalPages(total);
          }
        });
        if (!controller.signal.aborted) setNote(`已按原文件格式完整生成 ${result.total} 页扫描预览。`);
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "网络异常，请重试。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, slug, attempt]);

  return <section className={standalone ? "" : "border-t border-brand-line py-6 first:border-t-0 first:pt-0"}>
    {!standalone && <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">资料预览</h2>
        {!open && <p className="mt-1 text-sm text-neutral-500">以扫描件方式查看，正文无法直接选中复制。</p>}
      </div>
      <button type="button" aria-expanded={open} aria-controls="material-preview-content" onClick={() => setOpen(!open)} className="rounded-xl border border-brand-line bg-white px-5 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-[#f7f7f7]">
        {open ? "收起预览" : "预览资料"}
      </button>
    </div>}
    {open && <div id="material-preview-content" className={standalone ? "" : "mt-4"} aria-busy={loading}>
      {(loading || pages.length > 0) && <div className="material-scan-toolbar" role="toolbar" aria-label="预览工具栏">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#202020]">扫描预览</p>
          <p className="mt-0.5 text-xs text-[#777]">{pages.length ? `${pages.length}${totalPages > pages.length ? ` / ${totalPages}` : ""} 页` : "正在生成页面"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1" aria-label="缩放控制">
          <button type="button" className="material-scan-tool" aria-label="缩小" disabled={zoom <= 0.7} onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(1))))}>−</button>
          <button type="button" className="material-scan-zoom" aria-label="恢复原始缩放" onClick={() => setZoom(1)}>{zoomLabel}</button>
          <button type="button" className="material-scan-tool" aria-label="放大" disabled={zoom >= 1.4} onClick={() => setZoom((value) => Math.min(1.4, Number((value + 0.1).toFixed(1))))}>＋</button>
        </div>
      </div>}
      {loading && pages.length === 0 && <div role="status" className="material-scan-loading">
        <div className="material-scan-loading-page" />
        <p>正在生成扫描预览…</p>
      </div>}
      {error && <div role="alert" className="rounded-2xl border border-[#eadfc9] bg-[#fffaf1] p-5 text-sm text-[#6f5a39]">
        <p>{error}</p>
        <div className="mt-3 flex gap-4">
          {status === 401 ? <Link className="font-medium underline" href={`/login?redirect=${encodeURIComponent(`/materials/${encodeURIComponent(slug)}${standalone ? "/preview" : ""}`)}`}>前往登录</Link>
            : status === 403 ? <Link className="font-medium underline" href="/membership/payment">开通会员</Link>
            : <button type="button" onClick={() => setAttempt((value) => value + 1)} className="font-medium underline">重新加载</button>}
        </div>
      </div>}
      {pages.length > 0 && <>
        <div className="material-scan-stage" onCopy={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onDragStart={(event) => event.preventDefault()}>
          <div className="material-scan-pages" style={{ width: `${zoom * 100}%`, maxWidth: `${800 * zoom}px` }}>
            {pages.map((page, index) => <figure key={index} className="material-scan-sheet">
              <img src={page.src} width={page.width} height={page.height} draggable={false} alt={`第 ${index + 1} 页扫描预览`} />
              <figcaption>{index + 1}</figcaption>
            </figure>)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs leading-5 text-neutral-500">
          <p>{note || "内容已转换为扫描页显示。"}</p>
          <p>扫描预览 · 无法直接选中复制</p>
        </div>
      </>}
    </div>}
  </section>;
}
