export const WORK_CAT_CATEGORIES = [
  "reception",
  "faq",
  "resource_navigation",
  "reminder",
  "professional_question"
] as const;

export type WorkCatCategory = (typeof WORK_CAT_CATEGORIES)[number];

export type Classification = {
  category: WorkCatCategory;
  shouldReplyDirectly: boolean;
  needHuman: boolean;
  summary: string;
  reply: string;
  source: "rule" | "ai" | "fallback";
};

export type ConversationRow = {
  id: string;
  openid: string;
  role: "user" | "cat" | "xiaoxuan";
  content: string;
  category: string | null;
  created_at: string;
};
