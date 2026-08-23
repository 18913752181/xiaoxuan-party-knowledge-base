export const WORK_CAT_CATEGORIES = [
  "reception",
  "faq",
  "resource_navigation",
  "reminder",
  "professional_question",
  "tool",
  "human"
] as const;

export type WorkCatCategory = (typeof WORK_CAT_CATEGORIES)[number];

export const WORK_CAT_INTENTS = ["CHAT", "RESOURCE", "TOOL", "PARTY_AFFAIRS", "HUMAN"] as const;
export type WorkCatIntent = (typeof WORK_CAT_INTENTS)[number];

export type Classification = {
  category: WorkCatCategory;
  shouldReplyDirectly: boolean;
  needHuman: boolean;
  summary: string;
  reply: string;
  source: "rule" | "ai" | "fallback";
  /** 只用于服务端路由及后台记录，不会发给微信用户。 */
  intent: WorkCatIntent;
  confidence: number;
  target?: string;
  retrievalSummary?: string;
};

export type ConversationRow = {
  id: string;
  openid: string;
  role: "user" | "cat" | "xiaoxuan";
  content: string;
  category: string | null;
  created_at: string;
};
