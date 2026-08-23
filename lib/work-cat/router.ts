import "server-only";

import { classifyWithAi, generateChatReply } from "@/lib/work-cat/ai";
import { HUMAN_REPLY, PROFESSIONAL_REPLY, classifyByHardRules, fallbackProfessional, normalizeCatVoice } from "@/lib/work-cat/guardrails";
import { formatSearchSummary, searchWorkCatLibrary } from "@/lib/work-cat/library-search";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

const HUMAN_CONFIDENCE_THRESHOLD = 0.8;

function resourceReply(results: Awaited<ReturnType<typeof searchWorkCatLibrary>>) {
  const lines = results.map((item, index) => `${index + 1}. ${item.title}\nhttps://xiaoxuanvip.com${item.url}`);
  return `📚 咪在资料库里找到了这些：\n${lines.join("\n\n")}`;
}
function humanFromResource(content: string, retrievalSummary: string): Classification {
  return {
    category: "human", intent: "HUMAN", confidence: 1, target: content.slice(0, 120),
    shouldReplyDirectly: false, needHuman: true,
    summary: `资料库未找到明确结果：${content.slice(0, 120)}`,
    retrievalSummary,
    reply: HUMAN_REPLY, source: "rule"
  };
}

/** 五类意图的唯一入口：硬规则优先，低置信度和所有不确定结果一律 HUMAN。 */
export async function routeWorkCatMessage(content: string, context: ConversationRow[]): Promise<Classification> {
  const hard = classifyByHardRules(content);
  if (hard) {
    if (hard.intent === "RESOURCE") {
      const results = await searchWorkCatLibrary(content);
      const retrievalSummary = formatSearchSummary(results);
      if (!results.length) return humanFromResource(content, retrievalSummary);
      return { ...hard, confidence: 1, retrievalSummary, reply: resourceReply(results) };
    }
    if (hard.intent === "PARTY_AFFAIRS") {
      const results = await searchWorkCatLibrary(content);
      // 当前不让模型从知识条目自行推导党务结论：即使检索命中，也仅附到待办供小宣核对。
      return { ...hard, confidence: 1, retrievalSummary: formatSearchSummary(results), reply: PROFESSIONAL_REPLY };
    }
    return hard;
  }

  const identified = await classifyWithAi(content, context);
  if (identified.confidence < HUMAN_CONFIDENCE_THRESHOLD || identified.intent === "HUMAN") {
    return { ...fallbackProfessional(content), confidence: identified.confidence, summary: identified.summary || `意图不确定：${content.slice(0, 120)}` };
  }

  if (identified.intent === "RESOURCE") {
    const results = await searchWorkCatLibrary(content);
    const retrievalSummary = formatSearchSummary(results);
    return results.length
      ? { ...identified, category: "resource_navigation", shouldReplyDirectly: true, needHuman: false, retrievalSummary, reply: resourceReply(results) }
      : humanFromResource(content, retrievalSummary);
  }
  if (identified.intent === "TOOL") {
    // AI 未能被硬规则覆盖的工具需求保守转人工，不猜测不存在的入口。
    return { ...fallbackProfessional(content), confidence: identified.confidence, summary: `未识别到可用工具入口：${content.slice(0, 120)}` };
  }
  if (identified.intent === "PARTY_AFFAIRS") {
    const results = await searchWorkCatLibrary(content);
    return { ...identified, category: "professional_question", shouldReplyDirectly: false, needHuman: true, retrievalSummary: formatSearchSummary(results), reply: PROFESSIONAL_REPLY };
  }

  const reply = await generateChatReply(content, context);
  return { ...identified, category: "reception", intent: "CHAT", shouldReplyDirectly: true, needHuman: false, reply: normalizeCatVoice(reply) };
}
