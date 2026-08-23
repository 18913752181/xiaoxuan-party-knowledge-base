import "server-only";

import { fallbackProfessional } from "@/lib/work-cat/guardrails";
import { getProcessedReply, getRecentConversation, persistInteraction } from "@/lib/work-cat/repository";
import { routeWorkCatMessage } from "@/lib/work-cat/router";

export async function handleWorkCatMessage(input: { openid: string; content: string; msgId: string }) {
  const content = input.content.trim().slice(0, 2000);
  if (!content) return { reply: "咪只看到了空消息，可以再说一次吗？", duplicate: false };

  try {
    const [cachedReply, context] = await Promise.all([
      getProcessedReply(input.msgId, input.openid),
      getRecentConversation(input.openid, 8)
    ]);
    if (cachedReply) return { reply: cachedReply, duplicate: true };
    const classification = await routeWorkCatMessage(content, context, input.openid);
    console.info("[work-cat] reply prepared", {
      category: classification.category,
      intent: classification.intent,
      confidence: classification.confidence,
      source: classification.source,
      needHuman: classification.needHuman
    });
    const contextSummary = [
      ...context.slice(-5).map((row) => `${row.role === "user" ? "用户" : row.role === "cat" ? "Dimmo" : "小宣"}：${row.content}`),
      `用户：${content}`,
      `意图：${classification.intent}（置信度 ${classification.confidence}）`,
      `摘要：${classification.summary}`,
      classification.retrievalSummary ? `检索：${classification.retrievalSummary}` : ""
    ].join("\n").slice(0, 2000);

    await persistInteraction({ ...input, content, classification, contextSummary });
    return { reply: classification.reply, duplicate: false, classification };
  } catch (error) {
    console.error("[work-cat] message handling failed", error);
    return {
      reply: "🐾 咪的小本子刚刚卡了一下，这条还没记稳。麻烦稍后再发一次～",
      duplicate: false,
      classification: fallbackProfessional(content)
    };
  }
}
