import "server-only";

import { classifyWithAi, generateChatReply } from "@/lib/work-cat/ai";
import { HUMAN_REPLY, PROFESSIONAL_REPLY, classifyByHardRules, fallbackProfessional, normalizeCatVoice } from "@/lib/work-cat/guardrails";
import { formatSearchSummary, searchWorkCatLibrary } from "@/lib/work-cat/library-search";
import { cancelUpcomingReminder, friendlyReminderTime, getMembershipForOpenid, listUpcomingReminders, openidHasActiveMembership, validateAiReminder } from "@/lib/work-cat/member-reminders";
import { parseRuleReminder } from "@/lib/work-cat/reminder-parser";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

const HUMAN_CONFIDENCE_THRESHOLD = 0.8;
const MEMBERSHIP_STATUS_PATTERN = /(我(是|是不是|算不算).{0,4}会员|会员(状态|资格|到期|有效期)|查.{0,4}会员|是不是.{0,4}会员)/;
const REMINDER_LIST_PATTERN = /(?:查看|看看|查询|我的|查一下).{0,4}(?:提醒|待办)|(?:提醒|待办)(?:列表|清单)/;
const REMINDER_CANCEL_PATTERN = /^(?:取消|删掉|删除|不要)(?:一下)?(?:提醒|待办)?/;

function membershipStatusReply(membership: Awaited<ReturnType<typeof getMembershipForOpenid>>): Classification {
  if (membership.active) {
    const expiresAt = membership.expiresAt ? new Date(membership.expiresAt).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) : "会员到期日";
    return {
      category: "faq", intent: "CHAT", confidence: 1, source: "rule",
      shouldReplyDirectly: true, needHuman: false, summary: "查询公众号绑定会员状态",
      reply: `🐾 咪查到老大已经是会员啦，有效期到 ${expiresAt}。`
    };
  }
  return {
    category: "faq", intent: "CHAT", confidence: 1, source: "rule",
    shouldReplyDirectly: true, needHuman: false, summary: "未查询到公众号绑定会员",
    reply: "🐾 咪还没有查到这个微信绑定的有效会员记录。\n\n这不代表老大一定不是会员：公众号和网站账号是分开的，需要先在网站登录并绑定这个微信，咪才能认出老大。"
  };
}

async function listReminderReply(openid: string): Promise<Classification> {
  const reminders = await listUpcomingReminders(openid);
  if (!reminders.length) {
    return { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: "用户查看提醒，暂无待办", reply: "🐾 小本本里暂时没有待提醒的事。" };
  }
  const lines = reminders.map((item, index) => `${index + 1}. ${friendlyReminderTime(new Date(item.scheduled_at))} ${item.content}`);
  return { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: `用户查看 ${reminders.length} 条待提醒`, reply: `🐾 小本本里有这些：\n${lines.join("\n")}\n\n想取消的话，告诉咪“取消 + 事项”就好。` };
}

async function cancelReminderReply(content: string, openid: string): Promise<Classification> {
  const target = content.replace(REMINDER_CANCEL_PATTERN, "").replace(/(?:提醒|待办)/g, "").replace(/[，,。！？!；;、\s]/g, "");
  if (!target) {
    return { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: "用户要求取消提醒但未说明事项", reply: "🐾 想取消哪一条呀？例如说“取消明天8点按摩”，咪就能找到它。" };
  }
  const reminderKeyword = target.replace(/(?:今天|今晚|明天|明早|明晚|后天|(?:下|本|这)?(?:周|星期)?[一二三四五六日天]|\d{1,2}(?::\d{1,2}|点|时))/g, "");
  if (!reminderKeyword) {
    return { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: "用户取消提醒但缺少事项", reply: "🐾 咪还需要这条提醒的事项，例如“取消明天8点按摩”。" };
  }
  const cancelled = await cancelUpcomingReminder(openid, reminderKeyword);
  return cancelled
    ? { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: `已取消提醒：${cancelled.content}`, reply: `🐾 已把“${cancelled.content}”从小本本里划掉啦。` }
    : { category: "reception", intent: "CHAT", confidence: 1, source: "rule", shouldReplyDirectly: true, needHuman: false, summary: `未找到要取消的提醒：${target}`, reply: "🐾 咪没有找到这条待提醒。可以先说“查看提醒”，咪帮老大看一眼小本本。" };
}

async function routeScheduledReminder(identified: Classification, reminderAt: string, reminderContent: string, openid: string, receivedAt: Date): Promise<Classification> {
  const parsed = validateAiReminder(reminderAt, reminderContent, receivedAt);
  if (parsed.kind === "invalid") {
    return { ...identified, category: "reception", intent: "CHAT", shouldReplyDirectly: true, needHuman: false, summary: `定时提醒未创建：${parsed.reason}`, reply: `🐾 ${parsed.reason}。把时间和要记的事再说一次，咪就能帮老大记好。` };
  }
  const active = await openidHasActiveMembership(openid);
  if (!active) {
    return {
      ...identified, category: "reception", intent: "CHAT", shouldReplyDirectly: true, needHuman: false,
      summary: "非会员尝试使用定时提醒",
      reply: "🐾 到点提醒住在会员工作台里。\n\n已是资料库会员的老大，登录网站绑定这个微信就能直接用；还没开通的话，先去开通会员卡，咪再替老大记时间喵。"
    };
  }
  const action = /^(去|做|参加|完成|提交|联系|查看)/.test(parsed.content) ? parsed.content : `去${parsed.content}`;
  const timeText = friendlyReminderTime(new Date(parsed.scheduledAt), receivedAt);
  return {
    ...identified, category: "reminder", intent: "REMINDER", shouldReplyDirectly: true, needHuman: false, target: "会员到点提醒", reminderAt: parsed.scheduledAt, reminderContent: parsed.content,
    summary: `会员定时提醒：${parsed.displayTime}，${parsed.content}`,
    reply: `🐾 记好啦，${timeText}提醒老大${action}喵`
  };
}

async function routeAiReminder(content: string, identified: Classification, openid: string, receivedAt: Date): Promise<Classification> {
  // AI 只负责把一句话识别成“提醒”；最终日期、时间和可否创建必须由本地确定性解析器决定。
  const ruleReminder = parseRuleReminder(content, receivedAt);
  if (!ruleReminder || ruleReminder.kind === "needs_time" || ruleReminder.kind === "needs_content" || ruleReminder.kind === "needs_confirmation") {
    return {
      ...identified, category: "reception", intent: "CHAT", shouldReplyDirectly: true, needHuman: false,
      summary: `提醒信息需要确认：${content.slice(0, 120)}`,
      reply: ruleReminder?.reply || "🐾 咪把时间再确认一下：具体哪天几点提醒什么事呀？"
    };
  }
  return routeScheduledReminder(identified, ruleReminder.reminderAt, ruleReminder.reminderContent, openid, receivedAt);
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
export async function routeWorkCatMessage(content: string, context: ConversationRow[], openid: string, receivedAt = new Date()): Promise<Classification> {
  if (MEMBERSHIP_STATUS_PATTERN.test(content.trim())) {
    return membershipStatusReply(await getMembershipForOpenid(openid));
  }
  if (REMINDER_LIST_PATTERN.test(content.trim())) return listReminderReply(openid);
  if (REMINDER_CANCEL_PATTERN.test(content.trim())) return cancelReminderReply(content.trim(), openid);

  // 到点提醒必须在专业问题和通用人工兜底之前处理。常见表达由本地解析兜住，
  // 不受大模型超时、置信度或 JSON 格式影响；复杂说法再交由 DeepSeek 识别。
  const ruleReminder = parseRuleReminder(content, receivedAt);
  if (ruleReminder) {
    if (ruleReminder.kind === "needs_time" || ruleReminder.kind === "needs_content" || ruleReminder.kind === "needs_confirmation") {
      return {
        category: "reception", intent: "CHAT", confidence: 1, source: "rule",
        shouldReplyDirectly: true, needHuman: false,
        summary: `提醒信息不完整：${content.slice(0, 120)}`,
        reply: ruleReminder.reply
      };
    }
    return routeScheduledReminder({
      category: "reminder", intent: "REMINDER", confidence: 1, source: "rule",
      shouldReplyDirectly: true, needHuman: false,
      summary: `识别到提醒：${ruleReminder.reminderContent}`,
      reply: "", reminderAt: ruleReminder.reminderAt, reminderContent: ruleReminder.reminderContent
    }, ruleReminder.reminderAt, ruleReminder.reminderContent, openid, receivedAt);
  }

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
    if (hard.intent === "CHAT" && !hard.reply) {
      return { ...hard, reply: await generateChatReply(content, context) };
    }
    return hard;
  }

  const identified = await classifyWithAi(content, context);
  // DeepSeek 已明确判为提醒时，先校验其结构化时间和事项；
  // 短句提醒不再被通用的 0.8 置信度阈值误转给小宣。
  if (identified.intent === "REMINDER") return routeAiReminder(content, identified, openid, receivedAt);

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
