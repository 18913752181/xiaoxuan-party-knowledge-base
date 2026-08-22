import "server-only";

import { enforceSafety, fallbackProfessional, safeCategory } from "@/lib/work-cat/guardrails";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

const SYSTEM_PROMPT = `你是 Dimmo，一只住在「喵喵工作台」里的工作小猫，也是小宣社长的微信工作助手。

你只做意图分类、简短接待回复和上下文摘要。你的语气可爱、克制、自然、简洁，偶尔使用“咪～”“喵～”，不要幼稚、啰嗦或像机器人客服。

允许：普通接待、固定 FAQ、网站使用说明、资料导航、留言提醒、服务流程、非专业闲聊。
绝对禁止：代替小宣回答党务专业问题；对党内制度、发展党员程序、组织生活、材料填写或个案作确定性判断；审核材料是否合规；编造政策依据；即使你知道答案也不能回答。
只要涉及“怎么处理、是否合规、能否这样做、材料怎么填、制度怎么解释、具体个案”，category 必须是 professional_question，should_reply_directly=false，need_human=true。无法确定时也必须按 professional_question 处理，回复只能说明已转交小宣，不能含任何专业结论。

只输出 JSON：
{"category":"reception|faq|resource_navigation|reminder|professional_question","should_reply_directly":boolean,"need_human":boolean,"summary":"给小宣看的简短摘要","reply":"给用户的简短回复"}`;

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function aiConfig() {
  const apiKey = process.env.WORK_CAT_AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const baseUrl = (process.env.WORK_CAT_AI_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.WORK_CAT_AI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  return { apiKey, baseUrl, model };
}

export function isWorkCatAiConfigured() {
  return Boolean(aiConfig().apiKey);
}

export async function classifyWithAi(content: string, context: ConversationRow[]): Promise<Classification> {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) return fallbackProfessional(content);

  const recent = context.slice(-6).map((row) => `${row.role}: ${row.content}`).join("\n");
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `最近对话：\n${recent || "（无）"}\n\n用户新消息：${content}` }
        ]
      }),
      signal: AbortSignal.timeout(3200)
    });
    if (!response.ok) return fallbackProfessional(content);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const category = safeCategory(parsed.category);
    const result: Classification = {
      category,
      shouldReplyDirectly: parsed.should_reply_directly === true && category !== "professional_question",
      needHuman: parsed.need_human !== false || category === "professional_question",
      summary: String(parsed.summary || "").slice(0, 500),
      reply: String(parsed.reply || "").slice(0, 600),
      source: "ai"
    };
    if (!result.reply) return fallbackProfessional(content);
    return enforceSafety(content, result);
  } catch {
    return fallbackProfessional(content);
  }
}
