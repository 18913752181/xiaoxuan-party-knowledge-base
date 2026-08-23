import "server-only";

import { classifyWithAi, rewriteRuleReplyWithAi } from "@/lib/work-cat/ai";
import { classifyByHardRules, enforceSafety, fallbackProfessional } from "@/lib/work-cat/guardrails";
import { getProcessedReply, getRecentConversation, persistInteraction } from "@/lib/work-cat/repository";

export async function handleWorkCatMessage(input: { openid: string; content: string; msgId: string }) {
  const content = input.content.trim().slice(0, 2000);
  if (!content) return { reply: "咪只看到了空消息，可以再说一次吗？", duplicate: false };

  try {
    const [cachedReply, context] = await Promise.all([
      getProcessedReply(input.msgId, input.openid),
      getRecentConversation(input.openid, 8)
    ]);
    if (cachedReply) return { reply: cachedReply, duplicate: true };
    const ruleResult = classifyByHardRules(content);
    const candidate = ruleResult
      ? await rewriteRuleReplyWithAi(content, context, ruleResult)
      : await classifyWithAi(content, context);
    const classification = enforceSafety(content, candidate);
    const contextSummary = [
      ...context.slice(-5).map((row) => `${row.role === "user" ? "用户" : row.role === "cat" ? "Dimmo" : "小宣"}：${row.content}`),
      `用户：${content}`,
      `摘要：${classification.summary}`
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
