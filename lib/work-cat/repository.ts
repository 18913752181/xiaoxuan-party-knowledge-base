import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Classification, ConversationRow } from "@/lib/work-cat/types";

export async function getRecentConversation(openid: string, limit = 8): Promise<ConversationRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_conversations")
    .select("id,openid,role,content,category,created_at")
    .eq("openid", openid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as ConversationRow[]).reverse();
}

export async function getProcessedReply(msgId: string, openid: string) {
  if (!msgId) return null;
  const admin = getSupabaseAdmin();
  const { data: userMessage } = await admin
    .from("wechat_conversations")
    .select("created_at")
    .eq("wechat_msg_id", msgId)
    .maybeSingle();
  if (!userMessage?.created_at) return null;
  const { data: catReply } = await admin
    .from("wechat_conversations")
    .select("content")
    .eq("openid", openid)
    .eq("role", "cat")
    .gte("created_at", userMessage.created_at)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return typeof catReply?.content === "string" ? catReply.content : null;
}

export async function persistInteraction(input: {
  openid: string;
  msgId: string;
  content: string;
  classification: Classification;
  contextSummary: string;
}) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { openid, msgId, content, classification, contextSummary } = input;

  const writes = [
    admin.from("wechat_users").upsert(
      { openid, last_active_at: now },
      { onConflict: "openid", ignoreDuplicates: false }
    ),
    admin.from("wechat_conversations").insert({
      openid,
      role: "user",
      content,
      wechat_msg_id: msgId || null,
      category: classification.category
    }),
    admin.from("wechat_conversations").insert({
      openid,
      role: "cat",
      content: classification.reply,
      category: classification.category
    })
  ];

  if (classification.intent === "PROFESSIONAL_QA" || classification.intent === "HUMAN_HANDOFF") {
    writes.push(admin.from("pending_questions").insert({
      openid, question: content, context_summary: contextSummary || classification.summary,
      category: classification.category, status: "pending"
    }));
  } else if (classification.category === "reminder") {
    writes.push(admin.from("wechat_reminders").insert({
      openid,
      content: classification.reminderContent || content,
      source: "dimmo",
      status: classification.reminderAt ? "scheduled" : "pending",
      scheduled_at: classification.reminderAt || null
    }));
  }

  const results = await Promise.all(writes);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) throw error;
}
