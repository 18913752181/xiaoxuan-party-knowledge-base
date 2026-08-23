import "server-only";

import { membershipIsActive } from "@/lib/membership";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type ParsedReminder =
  | { kind: "none" }
  | { kind: "invalid"; reason: string }
  | { kind: "scheduled"; scheduledAt: string; displayTime: string; content: string };

const TIME_PATTERN = /(今天|明天|\d{1,2}月\d{1,2}日)\s*(上午|中午|下午|晚上)?\s*(\d{1,2})(?:[点时](\d{1,2})分?|[:：](\d{1,2}))?(?:分)?/;

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

/** 仅识别明确的日期和时间，避免把含糊留言误设成定时任务。 */
export function parseScheduledReminder(message: string, now = new Date()): ParsedReminder {
  const match = message.match(TIME_PATTERN);
  if (!match) return { kind: "none" };
  const [, dayText, period, hourText, minuteAfterHour, minuteAfterColon] = match;
  let hour = Number(hourText);
  const minute = Number(minuteAfterHour || minuteAfterColon || 0);
  if (hour > 23 || minute > 59) return { kind: "invalid", reason: "时间格式没有看明白" };
  if (period === "下午" || period === "晚上") {
    if (hour < 12) hour += 12;
  } else if (period === "中午" && hour < 11) {
    hour += 12;
  }

  const today = shanghaiParts(now);
  let year = today.year;
  let month = today.month;
  let day = today.day;
  if (dayText === "明天") {
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    year = tomorrow.getUTCFullYear(); month = tomorrow.getUTCMonth() + 1; day = tomorrow.getUTCDate();
  } else if (dayText !== "今天") {
    const pieces = dayText.match(/(\d{1,2})月(\d{1,2})日/);
    month = Number(pieces?.[1]); day = Number(pieces?.[2]);
    if (!month || !day) return { kind: "invalid", reason: "日期格式没有看明白" };
    if (month < today.month || (month === today.month && day < today.day)) year += 1;
  }
  // 将中国本地时间换成 UTC；中国时区固定为 UTC+8，不受服务器时区影响。
  const scheduled = new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
  if (scheduled.getTime() <= now.getTime() + 60_000) return { kind: "invalid", reason: "这个时间已经过去了" };
  // 当前通过公众号客服消息投递。该接口只在用户近期互动窗口内稳定可用，
  // 因此只开放 47 小时内的提醒，避免给会员创建最终无法送达的长期任务。
  if (scheduled.getTime() > now.getTime() + 47 * 3600_000) return { kind: "invalid", reason: "当前到点提醒最多可提前设置两天" };

  const content = message.replace(TIME_PATTERN, "").replace(/提醒(咪|我|一下)?/g, "").replace(/[，,。.!！]+/g, " ").trim();
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
