import "server-only";

import { membershipIsActive } from "@/lib/membership";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ParsedReminder =
  | { kind: "invalid"; reason: string }
  | { kind: "scheduled"; scheduledAt: string; displayTime: string; content: string };

function shanghaiParts(now = new Date()) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (type: string) => Number(values.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function formatShanghai(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).format(value).replace(/\//g, "月").replace(" ", "日 ");
}

/** 用接近日常对话的时间描述确认提醒，例如“今晚8点”“明天9点30分”。 */
export function friendlyReminderTime(value: Date, now = new Date()) {
  const target = shanghaiParts(value);
  const today = shanghaiParts(now);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const isToday = target.year === today.year && target.month === today.month && target.day === today.day;
  const isTomorrow = target.year === tomorrow.getUTCFullYear() && target.month === tomorrow.getUTCMonth() + 1 && target.day === tomorrow.getUTCDate();
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(value);
  const pick = (type: string) => Number(timeParts.find((part) => part.type === type)?.value || 0);
  const hour = pick("hour");
  const minute = pick("minute");
  const clock = `${hour}:${String(minute).padStart(2, "0")}`;
  if (isToday) return `${hour >= 19 ? "今晚" : "今天"} ${clock}`;
  if (isTomorrow) return `明天 ${clock}`;
  return `${target.month}月${target.day}日 ${clock}`;
}

/** DeepSeek 负责理解自然时间；这里仅校验其结构化结果，避免程序猜测用户本意。 */
export function validateAiReminder(reminderAt: string | undefined, reminderContent: string | undefined, now = new Date()): ParsedReminder {
  const scheduled = reminderAt ? new Date(reminderAt) : new Date(NaN);
  if (Number.isNaN(scheduled.getTime())) return { kind: "invalid", reason: "时间没有看明白" };
  if (scheduled.getTime() <= now.getTime() + 60_000) return { kind: "invalid", reason: "这个时间已经过去了" };
  // 当前通过公众号客服消息投递。该接口只在用户近期互动窗口内稳定可用，
  // 因此只开放 47 小时内的提醒，避免给会员创建最终无法送达的长期任务。
  if (scheduled.getTime() > now.getTime() + 47 * 3600_000) return { kind: "invalid", reason: "当前到点提醒最多可提前设置两天" };

  const content = (reminderContent || "").trim().slice(0, 240);
  if (!content) return { kind: "invalid", reason: "还少了要提醒的事情" };
  return { kind: "scheduled", scheduledAt: scheduled.toISOString(), displayTime: formatShanghai(scheduled), content: content.slice(0, 240) };
}

export async function getMembershipForOpenid(openid: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("profiles")
    .select("member_status,member_expires_at")
    .eq("wechat_openid", openid)
    .maybeSingle();
  if (error) throw error;
  return {
    bound: Boolean(data),
    active: membershipIsActive(data?.member_status, data?.member_expires_at),
    expiresAt: data?.member_expires_at || null
  };
}

export async function openidHasActiveMembership(openid: string) {
  return (await getMembershipForOpenid(openid)).active;
}

export type UpcomingReminder = { id: string; content: string; scheduled_at: string };

export async function listUpcomingReminders(openid: string, limit = 5): Promise<UpcomingReminder[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_reminders")
    .select("id,content,scheduled_at")
    .eq("openid", openid)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter((item): item is UpcomingReminder => Boolean(item.scheduled_at));
}

/** 只关闭该微信最早的一条匹配待办，避免“取消提醒”误删多条记录。 */
export async function cancelUpcomingReminder(openid: string, keyword: string) {
  const reminders = await listUpcomingReminders(openid, 20);
  const normalized = keyword.replace(/[，,。！？!；;、\s]/g, "");
  const item = reminders.find((row) => row.content.replace(/[，,。！？!；;、\s]/g, "").includes(normalized));
  if (!item) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_reminders")
    .update({ status: "closed" })
    .eq("id", item.id)
    .eq("openid", openid)
    .eq("status", "scheduled")
    .select("id,content,scheduled_at")
    .maybeSingle();
  if (error) throw error;
  return data as UpcomingReminder | null;
}
