import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendCustomerServiceText } from "@/lib/work-cat/wechat-customer-service";

type ScheduledReminder = {
  id: string;
  openid: string;
  content: string;
  attempts: number | null;
  last_attempt_at: string | null;
};

type DispatchResult = { scanned: number; sent: number; deferred: number; failed: number };

const RETRY_DELAY_MS = 3 * 60_000;
const MAX_ATTEMPTS = 3;

/**
 * 投递到期的会员提醒。每条先记录一次尝试，避免定时器重叠时发送重复消息。
 * 微信客服消息受互动窗口限制：连续失败三次后保留失败记录，交由后台查看。
 */
export async function dispatchDueMemberReminders(limit = 20): Promise<DispatchResult> {
  const appId = process.env.WECHAT_OFFICIAL_APP_ID?.trim() || "";
  const appSecret = process.env.WECHAT_OFFICIAL_APP_SECRET?.trim() || "";
  if (!appId || !appSecret) throw new Error("未配置微信公众号 AppID 或 AppSecret。");

  const admin = getSupabaseAdmin();
  const now = new Date();
  const { data, error } = await admin
    .from("wechat_reminders")
    .select("id,openid,content,attempts,last_attempt_at")
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;

  const result: DispatchResult = { scanned: data?.length || 0, sent: 0, deferred: 0, failed: 0 };
  for (const item of (data || []) as ScheduledReminder[]) {
    const lastAttempt = item.last_attempt_at ? new Date(item.last_attempt_at).getTime() : 0;
    if (lastAttempt && now.getTime() - lastAttempt < RETRY_DELAY_MS) {
      result.deferred += 1;
      continue;
    }

    const attempts = (item.attempts || 0) + 1;
    const { error: claimError } = await admin
      .from("wechat_reminders")
      .update({ attempts, last_attempt_at: now.toISOString(), delivery_error: null })
      .eq("id", item.id)
      .eq("status", "scheduled");
    if (claimError) throw claimError;

    const sent = await sendCustomerServiceText(item.openid, `🐾 到时间啦。\n\n咪提醒老大：${item.content}`, appId, appSecret);
    if (sent) {
      const { error: sentError } = await admin
        .from("wechat_reminders")
        .update({ status: "sent", dispatched_at: new Date().toISOString(), delivery_error: null })
        .eq("id", item.id)
        .eq("status", "scheduled");
      if (sentError) throw sentError;
      result.sent += 1;
      continue;
    }

    if (attempts >= MAX_ATTEMPTS) {
      const { error: failedError } = await admin
        .from("wechat_reminders")
        .update({
          status: "failed",
          delivery_error: "公众号提醒未能送达，可能已超过用户互动窗口。"
        })
        .eq("id", item.id)
        .eq("status", "scheduled");
      if (failedError) throw failedError;
      result.failed += 1;
    } else {
      result.deferred += 1;
    }
  }
  return result;
}
