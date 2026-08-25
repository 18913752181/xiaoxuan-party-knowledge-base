export type RuleReminder =
  | { kind: "scheduled"; reminderAt: string; reminderContent: string }
  | { kind: "needs_time"; reply: string }
  | { kind: "needs_content"; reply: string };

type ChinaDate = { year: number; month: number; day: number };

function chinaDate(now = new Date()): ChinaDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function chinaHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23"
  }).format(now));
}

function addDays(date: ChinaDate, days: number): ChinaDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function toShanghaiIso(date: ChinaDate, hour: number, minute: number) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
}

function weekdayOf(date: ChinaDate) {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

function removeTimeWords(value: string) {
  return value
    .replace(/(?:(?:下|本|这)?(?:周|星期))?[一二三四五六日天]/g, "")
    .replace(/(?:今(?:天|晚)|明(?:天|早|晚)|后天|大后天|早上|上午|中午|下午|晚上|夜里)/g, "")
    .replace(/(?:\d+|两|一|三|半)\s*(?:小时|分钟)后/g, "")
    .replace(/(?:[0-2]?\d)(?:[:：][0-5]?\d|点(?:半|[0-5]?\d分?)?|时(?:[0-5]?\d分?)?)/g, "")
    .replace(/提醒(?:一下|我)?|叫(?:醒)?我|到点(?:叫我|提醒)?|帮(?:咪)?记(?:一下|下)?|待办/g, "")
    .replace(/[，,。！？!；;、\s]+/g, "")
    .trim();
}

function normalizeChineseClock(value: string) {
  const single: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 零: 0 };
  return value.replace(/(二十[一二三]|十[一二三四五六七八九]?|[一二三四五六七八九十零])(?=(?:点|时))/g, (match) => {
    if (match === "二十") return "20";
    if (match.startsWith("二十")) return String(20 + single[match[2]]);
    if (match === "十") return "10";
    if (match.startsWith("十")) return String(10 + single[match[1]]);
    return String(single[match]);
  });
}

/**
 * 常见中文提醒的确定性解析。它只在“时间 + 事项”足够明确时创建提醒；
 * 不明确时返回追问，绝不把提醒误转给小宣。
 */
export function parseRuleReminder(raw: string, now = new Date()): RuleReminder | null {
  const text = normalizeChineseClock(raw.trim().replace(/：/g, ":"));
  if (!text) return null;

  const hasReminderVerb = /提醒|叫(?:醒)?我|到点|待办|帮.*记/.test(text);
  const hasTimeHint = /(?:今天|今晚|明天|明早|明晚|后天|大后天|早上|上午|中午|下午|晚上|夜里|(?:下|本|这)?(?:周|星期)?[一二三四五六日天]|\d{1,2}(?::\d{1,2}|点|时)|(?:\d+|两|一|三|半)\s*(?:小时|分钟)后)/.test(text);
  if (!hasReminderVerb && !hasTimeHint) return null;

  const content = removeTimeWords(text);
  if (!content) return { kind: "needs_content", reply: "🐾 要提醒什么事呀？告诉咪，咪记好后到点提醒老大。" };

  const relative = text.match(/(\d+|两|一|三|半)\s*(小时|分钟)后/);
  if (relative) {
    const numberText = relative[1];
    const count = numberText === "两" ? 2 : numberText === "一" ? 1 : numberText === "三" ? 3 : numberText === "半" ? 0.5 : Number(numberText);
    const milliseconds = relative[2] === "小时" ? count * 3600_000 : count * 60_000;
    const date = new Date(now.getTime() + milliseconds);
    return { kind: "scheduled", reminderAt: date.toISOString(), reminderContent: content };
  }

  const clock = text.match(/([01]?\d|2[0-3])(?::([0-5]\d)|点(半|([0-5]?\d)分?)?|时([0-5]?\d分?)?)/);
  const usesPeriodOnly = /明早|早上|上午|中午|下午|今晚|晚上|夜里/.test(text);
  if (!clock && !usesPeriodOnly) {
    return { kind: "needs_time", reply: "🐾 想在几点提醒呀？把时间告诉咪，咪就记进小本本。" };
  }

  let hour = clock ? Number(clock[1]) : /中午/.test(text) ? 12 : /下午/.test(text) ? 15 : /今晚|晚上|夜里/.test(text) ? 20 : 8;
  let minute = clock?.[2] ? Number(clock[2]) : clock?.[3] === "半" ? 30 : 0;
  const isPm = /下午|今晚|晚上|夜里/.test(text);
  if (isPm && hour < 12) hour += 12;
  // “8点按摩”按现有 Dimmo 约定默认理解为晚上八点。
  if (clock && !/早上|上午|中午|下午|今晚|晚上|夜里/.test(text) && hour >= 1 && hour <= 11) {
    // “明天 8 点起床/叫我”自然理解为早上；其他未说明时段的 8 点事项沿用夜间默认。
    if (!/(起床|叫(?:醒)?我)/.test(text)) hour += 12;
  }
  if (hour > 23 || minute > 59) return { kind: "needs_time", reply: "🐾 这个时间咪没有看明白，再说一次几点提醒好吗？" };

  let date = chinaDate(now);
  if (/后天/.test(text)) date = addDays(date, 2);
  else if (/明天|明早|明晚/.test(text)) date = addDays(date, 1);
  else {
    const weekday = text.match(/(?:(下|本|这)?(?:周|星期))?([一二三四五六日天])/);
    if (weekday) {
      const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
      const target = map[weekday[2]];
      let offset = (target - weekdayOf(date) + 7) % 7;
      if (weekday[1] === "下") offset += 7;
      else if (!weekday[1] && offset === 0 && hour <= chinaHour(now)) offset = 7;
      date = addDays(date, offset);
    }
  }

  const scheduled = new Date(toShanghaiIso(date, hour, minute));
  // 没有说明日期的时间，如果默认到今晚但已经过了，就顺延到明天。
  if (!/今天|今晚|明天|明早|明晚|后天|大后天|(?:下|本|这)?(?:周|星期)?[一二三四五六日天]/.test(text) && scheduled.getTime() <= now.getTime() + 60_000) {
    date = addDays(date, 1);
  }
  return { kind: "scheduled", reminderAt: toShanghaiIso(date, hour, minute), reminderContent: content };
}
