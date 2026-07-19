"use client";

import { TemplateResource } from "@/data/content";
import { MemberBadge } from "@/components/MemberBadge";

export function TemplateCard({ template }: { template: TemplateResource }) {
  function handleDownload() {
    if (template.isMemberOnly) {
      window.alert("该资料为会员内容，请先开通会员后查看或下载模板。");
      return;
    }

    window.alert("MVP 阶段暂未接入真实文件下载，后续可绑定对象存储或下载接口。");
  }

  return (
    <article className="rounded border border-brand-line bg-white p-5 transition hover:border-brand-red hover:shadow-soft">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded bg-brand-gray px-3 py-1 text-xs font-medium text-neutral-700">
          {template.category}
        </span>
        <span className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
          {template.fileType}
        </span>
        <MemberBadge isMemberOnly={template.isMemberOnly} />
      </div>
      <h2 className="mb-4 text-lg font-bold leading-7 text-brand-ink">{template.title}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
        <span>更新时间：{template.updatedAt}</span>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded bg-brand-red px-4 py-2 font-semibold text-white transition hover:bg-brand-darkRed"
        >
          下载
        </button>
      </div>
    </article>
  );
}
