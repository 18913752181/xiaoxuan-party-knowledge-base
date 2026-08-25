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
  if (scheduled.getTime() <= now.getTime()) return { kind: "invalid", reason: "这个时间已经过去了" };
  // 当前通过公众号客服消息投递。该接口只在用户近期互动窗口内稳定可用，
  // 因此只开放 48 小时内的提醒，避免给会员创建最终无法送达的长期任务。
  // 这里以“收到消息时”的固定基准比较，不能把分钟、小时或明天的提醒误拦截。
  const maxDelayMs = 48 * 60 * 60_000;
  if (scheduled.getTime() - now.getTime() > maxDelayMs) return { kind: "invalid", reason: "这个提醒超过了公众号可稳定送达的 48 小时范围" };

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

export type TaskRecord = {
  id: string;
  content: string;
  scheduled_at: string | null;
  status: "pending" | "scheduled" | "sent" | "failed" | "done" | "closed";
  source: "dimmo" | "miniprogram";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
};

export type UpcomingReminder = Pick<TaskRecord, "id" | "content"> & { scheduled_at: string };

const OPEN_TASK_STATUSES = ["pending", "scheduled", "sent", "failed"] as const;

function normalizeTaskKeyword(value: string) {
  return value.replace(/[，,。！？!；;、\s]/g, "").toLowerCase();
}

export function taskPublicStatus(status: TaskRecord["status"]) {
  if (status === "done") return "completed" as const;
  if (status === "closed") return "cancelled" as const;
  return "pending" as const;
}

export async function listMemberTasks(openid: string, options: {
  limit?: number;
  startAt?: string;
  endAt?: string;
  unfinishedOnly?: boolean;
} = {}): Promise<TaskRecord[]> {
  let query = getSupabaseAdmin()
    .from("wechat_reminders")
    .select("id,content,scheduled_at,status,source,created_at,updated_at,completed_at,cancelled_at")
    .eq("openid", openid);
  if (options.unfinishedOnly) query = query.in("status", [...OPEN_TASK_STATUSES]);
  if (options.startAt) query = query.gte("scheduled_at", options.startAt);
  if (options.endAt) query = query.lt("scheduled_at", options.endAt);
  const { data, error } = await query
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(options.limit || 200);
  if (error) throw error;
  return (data || []) as TaskRecord[];
}

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

/** 只更新该微信最近的一条匹配任务，避免一句话误改多条记录。 */
export async function findOpenTask(openid: string, keyword: string) {
  const tasks = await listMemberTasks(openid, { unfinishedOnly: true, limit: 50 });
  const normalized = normalizeTaskKeyword(keyword);
  if (!normalized) return null;
  return tasks
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .find((row) => {
      const content = normalizeTaskKeyword(row.content);
      return content.includes(normalized) || normalized.includes(content);
    }) || null;
}

export async function cancelUpcomingReminder(openid: string, keyword: string) {
  const item = await findOpenTask(openid, keyword);
  if (!item) return null;
  const now = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_reminders")
    .update({ status: "closed", cancelled_at: now })
    .eq("id", item.id)
    .eq("openid", openid)
    .in("status", [...OPEN_TASK_STATUSES])
    .select("id,content,scheduled_at")
    .maybeSingle();
  if (error) throw error;
  return data as UpcomingReminder | null;
}

export async function completeMemberTask(openid: string, keyword: string) {
  const item = await findOpenTask(openid, keyword);
  if (!item) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_reminders")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", item.id)
    .eq("openid", openid)
    .in("status", [...OPEN_TASK_STATUSES])
    .select("id,content,scheduled_at")
    .maybeSingle();
  if (error) throw error;
  return data as UpcomingReminder | null;
}

export async function rescheduleMemberTask(openid: string, keyword: string, scheduledAt: string) {
  const item = await findOpenTask(openid, keyword);
  if (!item) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("wechat_reminders")
    .update({
      scheduled_at: scheduledAt,
      status: "scheduled",
      dispatched_at: null,
      last_attempt_at: null,
      attempts: 0,
      delivery_error: null
    })
    .eq("id", item.id)
    .eq("openid", openid)
    .in("status", [...OPEN_TASK_STATUSES])
    .select("id,content,scheduled_at")
    .maybeSingle();
  if (error) throw error;
  return data as UpcomingReminder | null;
}
