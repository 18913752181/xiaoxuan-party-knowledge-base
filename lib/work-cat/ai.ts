import "server-only";

import { fallbackProfessional, normalizeCatVoice, safeIntent } from "@/lib/work-cat/guardrails";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

const SYSTEM_PROMPT = `你是 Dimmo，一只住在「喵喵工作台」里的工作小猫，也是小宣社长的微信工作助手。

你只做意图分类、简短接待回复和上下文摘要。你的语气可爱、克制、自然、简洁，有一点小猫感但不过度卖萌。
对外回复必须用“咪”自称，优先让“咪”作主语，禁止使用“我”或“我们”。可以自然使用“小本本”“好哒”“咪～”“喵～”等表达，但不要每句话都加语气词，也不要幼稚、啰嗦或像机器人客服。
称呼对方时，约八成场景省略“你/您”，通过自然语序直接表达；约两成轻松接待场景可以称“老大”。专业问题转交时不使用昵称或亲昵称呼。禁止使用“亲”“宝子”“主人”等客服化或过度卖萌的称呼。
一条回复中“～”或“~”最多出现一次。回复包含两个不同意思时，用空行分成两小段，不要把两句话黏在同一行；每段保持简短。

允许：普通接待、固定 FAQ、网站使用说明、资料导航、留言提醒、服务流程、非专业闲聊。
绝对禁止：代替小宣回答党务专业问题；对党内制度、发展党员程序、组织生活、材料填写或个案作确定性判断；审核材料是否合规；编造政策依据；即使你知道答案也不能回答。
只要涉及“怎么处理、是否合规、能否这样做、材料怎么填、制度怎么解释、具体个案”，intent 必须是 PARTY_AFFAIRS。无法确定时必须是 HUMAN。两种情况都不能给专业结论。

用户要求 Dimmo 在某个时间提醒待办，intent 必须是 REMINDER。REMINDER 只表示 Dimmo 到点提醒，不是让小宣社长回复。即使写得很口语，例如“今晚8点按摩”“8点按摩”，也应识别为 REMINDER。只提取 reminder_time_text（原句中的时间表达）和 reminder_content（仅保留待办事项，例如“按摩”）；禁止自行推断或输出最终日期时间，最终 remind_at 必须由服务器的北京时间解析器计算。没有能确定的时间时也仍可标记 REMINDER，由程序追问具体时间，不能因此转人工。

只输出 JSON：
{"intent":"CHAT|RESOURCE|TOOL|REMINDER|PARTY_AFFAIRS|HUMAN","confidence":0到1之间的小数,"target":"用户要找的资料、工具或问题对象","summary":"给小宣看的简短摘要","reminder_time_text":"仅 REMINDER 时复制用户时间表达，例如 今晚8点","reminder_content":"仅 REMINDER 时填写，例如 按摩"}

不得给专业党建问题生成答案。无法确认意图或置信度低于 0.8 时，intent 必须是 HUMAN。`;

const CHAT_SYSTEM_PROMPT = `你是 Dimmo。只回复已经由代码确认属于普通聊天的微信消息。
保持现有 Dimmo 语气：可爱、自然、简洁，用“咪”自称；不要使用“我/我们”；不要回答党务专业问题，不要编造资料、工具或政策。没有把握就简短表示咪会记下交给小宣。
只输出 JSON：{"reply":"回复内容"}`;

function stripJsonFence(value: string) {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function chinaNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:00+08:00`;
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
          { role: "system", content: `${SYSTEM_PROMPT}\n\n当前中国时间：${chinaNow()}` },
          { role: "user", content: `最近对话：\n${recent || "（无）"}\n\n用户新消息：${content}` }
        ]
      }),
      signal: AbortSignal.timeout(3200)
    });
    if (!response.ok) {
      console.warn("[work-cat] intent classification failed", { status: response.status, provider: baseUrl });
      return fallbackProfessional(content);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
    const intent = safeIntent(parsed.intent);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const result: Classification = {
      category: intent === "CHAT" ? "reception" : intent === "RESOURCE" ? "resource_navigation" : intent === "TOOL" ? "tool" : intent === "REMINDER" ? "reminder" : intent === "PARTY_AFFAIRS" ? "professional_question" : "human",
      intent,
      confidence,
      target: String(parsed.target || "").slice(0, 160),
      // 最终 reminderAt 不接受模型产出；router 会按固定接收时间用本地规则生成。
      reminderAt: undefined,
      reminderContent: typeof parsed.reminder_content === "string" ? parsed.reminder_content.slice(0, 240) : undefined,
      shouldReplyDirectly: (intent === "CHAT" || intent === "REMINDER") && confidence >= 0.8,
      needHuman: (intent !== "CHAT" && intent !== "REMINDER") || confidence < 0.8,
      summary: String(parsed.summary || "").slice(0, 500),
      reply: "",
      source: "ai"
    };
    return result;
  } catch (error) {
    console.warn("[work-cat] intent classification error", {
      error: error instanceof Error ? error.message : "unknown error",
      provider: baseUrl
    });
    return fallbackProfessional(content);
  }
}

export async function generateChatReply(content: string, context: ConversationRow[]) {
  const { apiKey, baseUrl, model } = aiConfig();
  if (!apiKey) return "🐾 咪在呢。有事慢慢说，咪会认真听。";
  const recent = context.slice(-6).map((row) => `${row.role}: ${row.content}`).join("\n");
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, temperature: 0.72, response_format: { type: "json_object" },
        messages: [{ role: "system", content: CHAT_SYSTEM_PROMPT }, { role: "user", content: `最近对话：\n${recent || "（无）"}\n\n用户消息：${content}` }]
      }),
      signal: AbortSignal.timeout(3200)
    });
    if (!response.ok) throw new Error("AI response failed");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(stripJsonFence(payload.choices?.[0]?.message?.content || "{}")) as Record<string, unknown>;
    const reply = String(parsed.reply || "").trim().slice(0, 600);
    return reply ? normalizeCatVoice(reply) : "🐾 咪在呢。有事慢慢说，咪会认真听。";
  } catch {
    return "🐾 咪在呢。有事慢慢说，咪会认真听。";
  }
}
