"use client";

import { useState } from "react";

export default function MaterialPurchasePreview({ slug }: { slug: string }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return (
    <section className="mt-7" aria-labelledby="material-preview-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="material-preview-heading" className="text-base font-semibold">文档预览</h2>
        <span className="text-xs text-neutral-500">第一页 · 前 1/3</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-brand-line bg-[#f8f7f4]">
        {failed ? <div className="flex min-h-40 flex-col items-center justify-center gap-2 p-5 text-sm text-neutral-600">
          <p>预览暂时不可用</p>
          <button type="button" className="min-h-11 px-4 underline" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>重试</button>
        </div> : (
          // eslint-disable-next-line @next/next/no-img-element -- The server returns only a cropped raster image.
          <img key={attempt} src={"/api/content-units/" + encodeURIComponent(slug) + "/preview?attempt=" + attempt} alt="文档第一页上方三分之一" className="block h-auto min-h-32 w-full bg-white" onError={() => setFailed(true)} draggable={false} />
        )}
      </div>
    </section>
  );
}
