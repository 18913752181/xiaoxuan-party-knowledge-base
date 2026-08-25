import faqRows from "@/data/work-cat-faq.json";
import type { Classification, WorkCatCategory, WorkCatIntent } from "@/lib/work-cat/types";

const PROFESSIONAL_PATTERNS = [
  /党(内|务|建|组织|员|支部|委会|小组)|支委会/,
  /预备党员|发展对象|积极分子|入党|转正|政审|组织生活|民主生活会|三会一课/,
  /发展党员|党费|处分|换届|选举|表决|票决|组织关系|党员档案|支部大会/,
  /合不合规|是否合规|符不符合|能不能这样|可不可以这样|应该怎么(办|处理)|怎么处理/,
  /制度|条例|规定|办法|程序|流程|审核|审查|材料.*(怎么填|填写|有问题|合规)/
];

// 这是“转告小宣”的人工留言，不是用户自己的到点提醒。
const MESSAGE_TO_XIAOXUAN_PATTERNS = [
  /提醒.*小宣|留(个)?言|传(个)?话|回来.*回复|让(她|社长).*回复|转告/
];
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
  /(你在干嘛|你在做什么|在忙吗|忙不忙|陪咪聊聊|陪我聊聊|今天好累|今天累死了|好累啊|心情不好|吃了吗|想聊天|今天.*有没有.*吃饭|今天.*心情怎么样|明天.*忙不忙)/
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

function isMessageToXiaoxuan(content: string) {
  return MESSAGE_TO_XIAOXUAN_PATTERNS.some((pattern) => pattern.test(content));
}

function isToolRequest(content: string) {
  return TOOL_PATTERNS.some((pattern) => pattern.test(content));
}

function localGreetingReply() {
  const hour = Number(new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23"
  }).format(new Date()));
  const period = hour < 12 ? "早上" : hour < 14 ? "中午" : hour < 19 ? "下午" : "晚上";
  return `🐾 ${period}好，咪在呢。\n\n老大有什么事尽管和咪说。`;
}

/** 只找文件/链接属于资料导航，即使文件名里有“入党、政审”等专业词。 */
function isPureResourceNavigation(content: string) {
  const asksForResource = RESOURCE_PATTERNS.some((pattern) => pattern.test(content)) || /哪里|在哪|链接|找.*(材料|表|记录|志愿书)/.test(content);
  return asksForResource && !PROFESSIONAL_DECISION_PATTERNS.some((pattern) => pattern.test(content));
}

export function isProfessionalByRule(content: string) {
  if (isMessageToXiaoxuan(content) || isPureResourceNavigation(content)) return false;
  return PROFESSIONAL_PATTERNS.some((pattern) => pattern.test(content));
}

export function classifyByHardRules(content: string): Classification | null {
  const text = content.trim();
  if (HUMAN_PATTERNS.some((pattern) => pattern.test(text))) {
    return classified({
      category: "human", intent: "HUMAN_HANDOFF", shouldReplyDirectly: false, needHuman: true,
      summary: `用户明确要求小宣社长处理：${text.slice(0, 120)}`,
      reply: HUMAN_REPLY, source: "rule", target: "小宣社长"
    });
  }
  if (isMessageToXiaoxuan(text)) {
    return classified({
      category: "human", intent: "HUMAN_HANDOFF",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: `用户给小宣的提醒或留言：${text.slice(0, 120)}`,
      reply: HUMAN_REPLY, source: "rule", target: "小宣社长"
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
      category: "professional_question", intent: "PROFESSIONAL_QA",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: `用户咨询专业党务问题：${text.slice(0, 120)}`,
      reply: PROFESSIONAL_REPLY,
      source: "rule"
    });
  }

  // 产品 FAQ 优先于“找资料”检索；“资料库在哪里”是产品入口，不应因没有具体资料名被转人工。
  const faq = faqRows.find((row) => row.keywords.some((keyword) => text.includes(keyword)));
  if (faq) {
    return classified({
      category: "faq", intent: "PRODUCT_QA",
      shouldReplyDirectly: true,
      needHuman: false,
      summary: `产品功能问题：${faq.id}`,
      reply: faq.reply,
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
  const allowed: WorkCatIntent[] = ["CHAT", "RESOURCE", "TOOL", "REMINDER", "PRODUCT_QA", "PROFESSIONAL_QA", "HUMAN_HANDOFF"];
  return allowed.includes(value as WorkCatIntent) ? (value as WorkCatIntent) : "HUMAN_HANDOFF";
}

/** 模型输出后的第二道闸：命中专业规则、分类未知或模型犹豫，一律转人工。 */
export function enforceSafety(content: string, result: Classification): Classification {
  if (isProfessionalByRule(content) || result.intent === "PROFESSIONAL_QA" || result.intent === "HUMAN_HANDOFF" || !result.shouldReplyDirectly) {
    return {
      ...result,
      category: result.intent === "HUMAN_HANDOFF" ? "human" : "professional_question",
      intent: result.intent === "HUMAN_HANDOFF" ? "HUMAN_HANDOFF" : "PROFESSIONAL_QA",
      shouldReplyDirectly: false,
      needHuman: true,
      summary: result.summary || `用户咨询专业问题：${content.slice(0, 120)}`,
      reply: result.intent === "HUMAN_HANDOFF" ? HUMAN_REPLY : PROFESSIONAL_REPLY
    };
  }
  return { ...result, reply: normalizeCatVoice(result.reply) };
}

export function fallbackProfessional(content: string): Classification {
  return classified({
    category: "human", intent: "HUMAN_HANDOFF",
    shouldReplyDirectly: false,
    needHuman: true,
    summary: `分类不确定，已按专业问题转人工：${content.slice(0, 120)}`,
    reply: HUMAN_REPLY,
    source: "fallback"
  });
}
