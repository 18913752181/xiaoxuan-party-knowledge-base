import "server-only";

import { listContentUnits } from "@/lib/content-units";

export type WorkCatSearchResult = {
  title: string;
  url: string;
  summary: string;
  score: number;
};

const STOP_WORDS = ["有没有", "帮我", "帮忙", "哪里", "在哪", "怎么", "一份", "有关", "关于", "资料", "材料", "模板", "文件", "下载", "找找", "想找", "需要", "找", "的", "流程"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s，。、“”‘’《》？！!?,.]/g, "");
}

function queryTerms(query: string) {
  let value = normalize(query);
  for (const word of STOP_WORDS) value = value.replaceAll(word, "");
  const terms = value.match(/[\u4e00-\u9fff]{2,}|[a-z0-9]{2,}/g) || [];
  return Array.from(new Set(terms)).slice(0, 8);
}

/**
 * 资料库仅按已发布内容做本地检索；没有明确命中时返回空，调用方必须转人工，不能猜链接。
 */
export async function searchWorkCatLibrary(query: string, limit = 3): Promise<WorkCatSearchResult[]> {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const units = await listContentUnits();
  return units.map((unit) => {
    const title = normalize(unit.meta.title);
    const searchable = normalize([
      unit.meta.title, unit.meta.category, unit.meta.topic, unit.meta.stage,
      unit.tags.join(" "), unit.meta.summary, unit.summary
    ].join(" "));
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 12 : searchable.includes(term) ? 4 : 0), 0);
    return {
      title: unit.meta.title,
      url: `/materials/${unit.slug}`,
      summary: (unit.meta.summary || unit.summary || "资料库内容").replace(/\s+/g, " ").slice(0, 90),
      score
    };
  }).filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatSearchSummary(results: WorkCatSearchResult[]) {
  return results.length ? results.map((item) => `${item.title}（${item.url}）`).join("；") : "未找到明确资料库结果";
}
