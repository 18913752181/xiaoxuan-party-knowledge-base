import faqRows from "@/data/work-cat-faq.json";
import type { Classification, WorkCatCategory } from "@/lib/work-cat/types";

const PROFESSIONAL_PATTERNS = [
  /党(内|务|建|组织|员|支部|委会|小组)/,
  /预备党员|发展对象|积极分子|入党|转正|政审|组织生活|民主生活会|三会一课/,
  /发展党员|党费|处分|换届|选举|表决|票决|组织关系|党员档案|支部大会/,
  /合不合规|是否合规|符不符合|能不能这样|可不可以这样|应该怎么(办|处理)|怎么处理/,
  /制度|条例|规定|办法|程序|流程|审核|审查|材料.*(怎么填|填写|有问题|合规)/
];

const REMINDER_PATTERNS = [/提醒.*小宣|帮我.*提醒|留(个)?言|传(个)?话|回来.*回复|让(她|社长).*回复|转告/];
const RESOURCE_PATTERNS = [/模板|资料|材料.*哪里|有没有.*(记录|表|范文)|想找|下载/];
const RECEPTION_PATTERNS = [/^(你好|您好|嗨|hi|hello|在吗|有人吗)[呀吗呢～~!！。 ]*$/i, /你是谁|小宣在吗|社长在吗/];
const PROFESSIONAL_DECISION_PATTERNS = [/怎么填|如何填写|怎么处理|怎么办|合不合规|是否合规|能不能|可不可以|判断|解释|审核|审查|结论|依据/];

export const PROFESSIONAL_REPLY = "🐾 这个涉及具体党务判断，咪不敢替社长乱说。我先帮你记下来，等小宣社长回来后让她回复你～";

function isReminder(content: string) {
  return REMINDER_PATTERNS.some((pattern) => pattern.test(content));
}

/** 只找文件/链接属于资料导航，即使文件名里有“入党、政审”等专业词。 */
function isPureResourceNavigation(content: string) {
  const asksForResource = RESOURCE_PATTERNS.some((pattern) => pattern.test(content)) || /哪里|在哪|链接|找.*(材料|表|记录|志愿书)/.test(content);
  return asksForResource && !PROFESSIONAL_DECISION_PATTERNS.some((pattern) => pattern.test(content));
}

export function isProfessionalByRule(content: string) {
  if (isReminder(content) || isPureResourceNavigation(content)) return false;
  return PROFESSIONAL_PATTERNS.some((pattern) => pattern.test(content));
}

export function classifyByHardRules(content: string): Classification | null {
  const text = content.trim();
  if (isReminder(text)) {
    return {
      category: "reminder",
      shouldReplyDirectly: true,
      needHuman: true,
      summary: `用户给小宣的提醒或留言：${text.slice(0, 120)}`,
      reply: "好呀，咪已经记进社长的待办里了 🐾",
      source: "rule"
    };
  }

  if (isPureResourceNavigation(text)) {
    return {
      category: "resource_navigation",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: `用户想查找资料：${text.slice(0, 120)}`,
      reply: "📚 可以先到喵喵资料库搜索关键词：https://xiaoxuanvip.com/\n如果没找到，把资料名称告诉咪，我再帮你记下来～",
      source: "rule"
    };
  }

  if (isProfessionalByRule(text)) {
    return {
      category: "professional_question",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: `用户咨询专业党务问题：${text.slice(0, 120)}`,
      reply: PROFESSIONAL_REPLY,
      source: "rule"
    };
  }

  const faq = faqRows.find((row) => row.keywords.some((keyword) => text.includes(keyword)));
  if (faq) {
    return {
      category: "faq",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: `固定客服问题：${faq.id}`,
      reply: faq.reply,
      source: "rule"
    };
  }

  if (RECEPTION_PATTERNS.some((pattern) => pattern.test(text))) {
    const asksWho = /你是谁/.test(text);
    return {
      category: "reception",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: "普通接待",
      reply: asksWho
        ? "我是 Dimmo，一只住在「喵喵工作台」里的工作小猫。小宣社长不在时，由咪负责接待、传话和帮你找资料 🐾"
        : "🐾 社长现在不在，赚钱养咪了喵～有事可以先告诉咪，咪会帮你记好～",
      source: "rule"
    };
  }

  return null;
}

export function safeCategory(value: unknown): WorkCatCategory {
  const allowed: WorkCatCategory[] = ["reception", "faq", "resource_navigation", "reminder", "professional_question"];
  return allowed.includes(value as WorkCatCategory) ? (value as WorkCatCategory) : "professional_question";
}

/** 模型输出后的第二道闸：命中专业规则、分类未知或模型犹豫，一律转人工。 */
export function enforceSafety(content: string, result: Classification): Classification {
  if (isProfessionalByRule(content) || result.category === "professional_question" || !result.shouldReplyDirectly) {
    return {
      ...result,
      category: "professional_question",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: result.summary || `用户咨询专业问题：${content.slice(0, 120)}`,
      reply: PROFESSIONAL_REPLY
    };
  }
  return result;
}

export function fallbackProfessional(content: string): Classification {
  return {
    category: "professional_question",
    shouldReplyDirectly: false,
    needHuman: true,
    summary: `分类不确定，已按专业问题转人工：${content.slice(0, 120)}`,
    reply: PROFESSIONAL_REPLY,
    source: "fallback"
  };
}
