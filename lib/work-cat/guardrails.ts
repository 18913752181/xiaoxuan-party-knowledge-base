import faqRows from "@/data/work-cat-faq.json";
import type { Classification, WorkCatCategory, WorkCatIntent } from "@/lib/work-cat/types";

const PROFESSIONAL_PATTERNS = [
  /党(内|务|建|组织|员|支部|委会|小组)/,
  /预备党员|发展对象|积极分子|入党|转正|政审|组织生活|民主生活会|三会一课/,
  /发展党员|党费|处分|换届|选举|表决|票决|组织关系|党员档案|支部大会/,
  /合不合规|是否合规|符不符合|能不能这样|可不可以这样|应该怎么(办|处理)|怎么处理/,
  /制度|条例|规定|办法|程序|流程|审核|审查|材料.*(怎么填|填写|有问题|合规)/
];

const REMINDER_PATTERNS = [/提醒.*小宣|帮我.*提醒|留(个)?言|传(个)?话|回来.*回复|让(她|社长).*回复|转告/];
const RESOURCE_PATTERNS = [/模板|资料|材料.*哪里|有没有.*(记录|表|范文)|想找|下载/];
const TOOL_PATTERNS = [/算.*入党.*时间|入党.*时间.*(算|核算)|什么时候.*转正|什么时候.*满一年|满一年.*(算|核算)|红色教育基地|教育基地.*(在哪|哪里|参观|导览)|基地.*(参观|导览)/];
const HUMAN_PATTERNS = [/^(我要|想要|请|麻烦)?找小宣(社长)?[。！!～~ ]*$/i, /人工(回复|客服|处理)?/, /请小宣(社长)?(回复|看看|处理)/];
const RECEPTION_PATTERNS = [
  /^(你好|您好|嗨|hi|hello|在吗|有人吗|早上好|上午好|中午好|下午好|晚上好|晚安)[呀吗呢啊咪～~!！。 ]*$/i,
  /你是谁|小宣在吗|社长在吗/,
  /小宣是谁|社长是谁|小宣.*(什么人|做什么)|社长.*(什么人|做什么)/
];
// 明确的日常互动不交给低置信度模型判断，避免“你在干嘛”之类被误转人工。
const CASUAL_CHAT_PATTERNS = [
  /^(哈哈|哈哈哈|嘿嘿|呵呵|谢谢|谢啦|辛苦了|晚安|早安|午安)[呀啦哦～~!！。 ]*$/,
  /(你在干嘛|你在做什么|在忙吗|忙不忙|陪咪聊聊|陪我聊聊|今天好累|好累啊|心情不好|吃了吗|想聊天)/
];
const PROFESSIONAL_DECISION_PATTERNS = [/怎么填|如何填写|怎么处理|怎么办|合不合规|是否合规|能不能|可不可以|判断|解释|审核|审查|结论|依据/];

export const PROFESSIONAL_REPLY = "🐾 这个要请社长做专业判断，咪不敢乱答～问题已经收进小本本，等小宣社长回来回复喵。";
export const HUMAN_REPLY = "这个问题咪先帮老大记下来，交给小宣社长确认一下 🐾";

function classified(input: Omit<Classification, "intent" | "confidence"> & { intent: WorkCatIntent; confidence?: number }) {
  return { ...input, confidence: input.confidence ?? 1 };
}

/** Dimmo 对外回复统一以“咪”自称，避免生成内容突然切回普通客服口吻。 */
export function normalizeCatVoice(reply: string) {
  const catVoice = reply.replace(/我们/g, "咪这边").replace(/我/g, "咪");
  let hasTilde = false;
  return catVoice.replace(/[～~]+/g, () => {
    if (hasTilde) return "";
    hasTilde = true;
    return "～";
  });
}

function isReminder(content: string) {
  return REMINDER_PATTERNS.some((pattern) => pattern.test(content));
}

function isToolRequest(content: string) {
  return TOOL_PATTERNS.some((pattern) => pattern.test(content));
}

function localGreetingReply() {
  const hour = Number(new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23"
  }).format(new Date()));
  const period = hour >= 5 && hour < 11 ? "早上" : hour >= 11 && hour < 14 ? "中午" : hour >= 14 && hour < 18 ? "下午" : "晚上";
  return `🐾 ${period}好，咪在呢。\n\n老大有什么事尽管和咪说。`;
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
  if (HUMAN_PATTERNS.some((pattern) => pattern.test(text))) {
    return classified({
      category: "human", intent: "HUMAN", shouldReplyDirectly: false, needHuman: true,
      summary: `用户明确要求小宣社长处理：${text.slice(0, 120)}`,
      reply: HUMAN_REPLY, source: "rule", target: "小宣社长"
    });
  }
  if (isReminder(text)) {
    return classified({
      category: "reminder", intent: "CHAT",
      shouldReplyDirectly: true,
      needHuman: true,
      summary: `用户给小宣的提醒或留言：${text.slice(0, 120)}`,
      reply: "好哒，咪已经记进社长的待办小本本啦 🐾",
      source: "rule"
    });
  }

  if (isToolRequest(text)) {
    const isBase = /基地/.test(text);
    return classified({
      category: "tool", intent: "TOOL", shouldReplyDirectly: true, needHuman: false,
      target: isBase ? "红色教育基地导览" : "入党时间核算",
      summary: `用户想使用工具：${isBase ? "红色教育基地导览" : "入党时间核算"}`,
      reply: isBase
        ? "🧰 这个可以用「红色教育基地导览」找找。咪不替老大编地点，打开喵喵小程序后选「教育基地导航」就能按地区和类型查～"
        : "🧰 这个要用「入党时间核算」来算。咪不代替工具手算，打开喵喵小程序后选「入党时间核算」，把关键日期填进去就好～",
      source: "rule"
    });
  }

  if (isProfessionalByRule(text)) {
    return classified({
      category: "professional_question", intent: "PARTY_AFFAIRS",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: `用户咨询专业党务问题：${text.slice(0, 120)}`,
      reply: PROFESSIONAL_REPLY,
      source: "rule"
    });
  }

  if (isPureResourceNavigation(text)) {
    return classified({
      category: "resource_navigation", intent: "RESOURCE", shouldReplyDirectly: true, needHuman: false,
      target: text.slice(0, 120), summary: `用户想查找资料：${text.slice(0, 120)}`,
      reply: "", source: "rule"
    });
  }

  const faq = faqRows.find((row) => row.keywords.some((keyword) => text.includes(keyword)));
  if (faq) {
    return classified({
      category: "faq", intent: "CHAT",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: `固定客服问题：${faq.id}`,
      reply: faq.reply,
      source: "rule"
    });
  }

  if (RECEPTION_PATTERNS.some((pattern) => pattern.test(text))) {
    const asksWho = /你是谁/.test(text);
    const asksAboutXiaoxuan = /小宣是谁|社长是谁|小宣.*(什么人|做什么)|社长.*(什么人|做什么)/.test(text);
    const asksWhereIsXiaoxuan = /小宣在吗|社长在吗/.test(text);
    return classified({
      category: "reception", intent: "CHAT",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: "普通接待",
      reply: asksAboutXiaoxuan
        ? "小宣是「干货社」社长，也是公主号「小宣同志」本人，平时社长和咪一起住在「喵喵工作台」喵。"
        : asksWho
        ? "咪是 Dimmo，一只住在「喵喵工作台」里的工作小猫～社长不在时，接待、传话和找资料都可以交给咪 🐾"
        : asksWhereIsXiaoxuan
        ? "🐾 社长现在不在，出去赚钱养咪了喵。\n\n老大有事尽管告诉咪，咪记在待办小本本～"
        : localGreetingReply(),
      source: "rule"
    });
  }

  if (CASUAL_CHAT_PATTERNS.some((pattern) => pattern.test(text))) {
    return classified({
      category: "reception", intent: "CHAT", shouldReplyDirectly: true, needHuman: false,
      summary: "普通闲聊", reply: "", source: "rule"
    });
  }

  return null;
}

export function safeCategory(value: unknown): WorkCatCategory {
  const allowed: WorkCatCategory[] = ["reception", "faq", "resource_navigation", "reminder", "professional_question", "tool", "human"];
  return allowed.includes(value as WorkCatCategory) ? (value as WorkCatCategory) : "professional_question";
}

export function safeIntent(value: unknown): WorkCatIntent {
  const allowed: WorkCatIntent[] = ["CHAT", "RESOURCE", "TOOL", "PARTY_AFFAIRS", "HUMAN"];
  return allowed.includes(value as WorkCatIntent) ? (value as WorkCatIntent) : "HUMAN";
}

/** 模型输出后的第二道闸：命中专业规则、分类未知或模型犹豫，一律转人工。 */
export function enforceSafety(content: string, result: Classification): Classification {
  if (isProfessionalByRule(content) || result.intent === "PARTY_AFFAIRS" || result.intent === "HUMAN" || !result.shouldReplyDirectly) {
    return {
      ...result,
      category: result.intent === "HUMAN" ? "human" : "professional_question",
      intent: result.intent === "HUMAN" ? "HUMAN" : "PARTY_AFFAIRS",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: result.summary || `用户咨询专业问题：${content.slice(0, 120)}`,
      reply: result.intent === "HUMAN" ? HUMAN_REPLY : PROFESSIONAL_REPLY
    };
  }
  return { ...result, reply: normalizeCatVoice(result.reply) };
}

export function fallbackProfessional(content: string): Classification {
  return classified({
    category: "human", intent: "HUMAN",
    shouldReplyDirectly: false,
    needHuman: true,
    summary: `分类不确定，已按专业问题转人工：${content.slice(0, 120)}`,
    reply: HUMAN_REPLY,
    source: "fallback"
  });
}
