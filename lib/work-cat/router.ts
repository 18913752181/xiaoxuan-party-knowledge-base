import "server-only";

import { classifyWithAi, generateChatReply } from "@/lib/work-cat/ai";
import { HUMAN_REPLY, PROFESSIONAL_REPLY, classifyByHardRules, fallbackProfessional, normalizeCatVoice } from "@/lib/work-cat/guardrails";
import { formatSearchSummary, searchWorkCatLibrary } from "@/lib/work-cat/library-search";
import { getMembershipForOpenid, openidHasActiveMembership, parseScheduledReminder } from "@/lib/work-cat/member-reminders";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

const HUMAN_CONFIDENCE_THRESHOLD = 0.8;
const MEMBERSHIP_STATUS_PATTERN = /(我(是|是不是|算不算).{0,4}会员|会员(状态|资格|到期|有效期)|查.{0,4}会员|是不是.{0,4}会员)/;

function membershipStatusReply(membership: Awaited<ReturnType<typeof getMembershipForOpenid>>): Classification {
  if (membership.active) {
    const expiresAt = membership.expiresAt ? new Date(membership.expiresAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "会员到期日";
    return {
      category: "faq", intent: "CHAT", confidence: 1, source: "rule",
      shouldReplyDirectly: true, needHuman: false, summary: "查询公众号绑定会员状态",
      reply: `🐾 咪查到老大已经是会员啦，有效期到 ${expiresAt}。\n\n资料库和 Dimmo 的会员功能都可以直接用。`
    };
  }
  return {
    category: "faq", intent: "CHAT", confidence: 1, source: "rule",
    shouldReplyDirectly: true, needHuman: false, summary: "未查询到公众号绑定会员",
    reply: "🐾 咪还没有查到这个微信绑定的有效会员记录。\n\n这不代表老大一定不是会员：公众号和网站账号是分开的，需要先在网站登录并绑定这个微信，咪才能认出老大。"
  };
}

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
export async function routeWorkCatMessage(content: string, context: ConversationRow[], openid: string): Promise<Classification> {
  if (MEMBERSHIP_STATUS_PATTERN.test(content.trim())) {
    return membershipStatusReply(await getMembershipForOpenid(openid));
  }
  const hard = classifyByHardRules(content);
  if (hard) {
    if (hard.category === "reminder") {
      const parsed = parseScheduledReminder(content);
      if (parsed.kind === "invalid") {
        return { ...hard, category: "reception", needHuman: false, summary: `定时提醒未创建：${parsed.reason}`, reply: `🐾 ${parsed.reason}。把时间和要记的事再说一次，咪就能帮老大记好。` };
      }
      if (parsed.kind === "scheduled") {
        const active = await openidHasActiveMembership(openid);
        if (!active) {
          return {
            ...hard, category: "reception", needHuman: false,
            summary: "非会员尝试使用定时提醒",
            reply: "🐾 到点提醒住在会员通行卡里。先在网站登录并绑定现在这个微信，再开通或确认会员，咪就能替老大按时记着。"
          };
        }
        return {
          ...hard, needHuman: false, target: "会员到点提醒", reminderAt: parsed.scheduledAt, reminderContent: parsed.content,
          summary: `会员定时提醒：${parsed.displayTime}，${parsed.content}`,
          reply: `🐾 咪记好了。\n\n${parsed.displayTime} 提醒老大：${parsed.content}`
        };
      }
    }
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
    if (hard.intent === "CHAT" && !hard.reply) {
      return { ...hard, reply: await generateChatReply(content, context) };
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
