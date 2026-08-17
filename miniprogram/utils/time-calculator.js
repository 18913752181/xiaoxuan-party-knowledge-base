const config = require("../config/time-rules");

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatChineseDate(value) {
  const date = typeof value === "string" ? parseDate(value) : value;
  return date ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` : "—";
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addMonths(value, months) {
  const source = typeof value === "string" ? parseDate(value) : value;
  if (!source) return null;
  const targetMonth = source.getMonth() + months;
  const targetYear = source.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const targetDay = Math.min(source.getDate(), daysInMonth(targetYear, normalizedMonth));
  return new Date(targetYear, normalizedMonth, targetDay, 12, 0, 0, 0);
}

function addYears(value, years) {
  return addMonths(value, years * 12);
}

function dayNumber(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function differenceInDays(fromValue, toValue) {
  const from = typeof fromValue === "string" ? parseDate(fromValue) : fromValue;
  const to = typeof toValue === "string" ? parseDate(toValue) : toValue;
  if (!from || !to) return null;
  return Math.round(dayNumber(to) - dayNumber(from));
}

function calendarDifference(fromValue, toValue) {
  const from = typeof fromValue === "string" ? parseDate(fromValue) : fromValue;
  const to = typeof toValue === "string" ? parseDate(toValue) : toValue;
  if (!from || !to) return "—";
  if (differenceInDays(from, to) < 0) return `相差 ${Math.abs(differenceInDays(from, to))} 天（日期倒序）`;

  let years = to.getFullYear() - from.getFullYear();
  let cursor = addYears(from, years);
  if (cursor > to) {
    years -= 1;
    cursor = addYears(from, years);
  }

  let months = 0;
  while (months < 11) {
    const next = addMonths(cursor, 1);
    if (next > to) break;
    cursor = next;
    months += 1;
  }
  const days = differenceInDays(cursor, to);
  const parts = [];
  if (years) parts.push(`${years}年`);
  if (months) parts.push(`${months}个月`);
  if (days || !parts.length) parts.push(`${days}天`);
  return parts.join("");
}

function issue(level, title, detail, ruleId) {
  return { level, title, detail, ruleId: ruleId || "date-order" };
}

function getTodayValue(todayValue) {
  if (todayValue && parseDate(todayValue)) return todayValue;
  return formatDate(new Date());
}

function validateSequence(values, todayValue) {
  const issues = [];
  let missingSeen = false;
  let previous = null;

  config.fields.forEach((field, index) => {
    const value = values[field.key];
    if (!value) {
      if (index === 0) issues.push(issue("error", "缺少必填日期", "请填写递交入党申请书日期。"));
      missingSeen = true;
      return;
    }
    const parsed = parseDate(value);
    if (!parsed) {
      issues.push(issue("error", "日期格式有误", `${field.label}不是有效日期。`));
      return;
    }
    if (missingSeen) {
      issues.push(issue("error", "阶段日期不完整", `${field.label}之前存在未填写的阶段，请按顺序补充。`));
    }
    if (previous && differenceInDays(previous.value, value) < 0) {
      issues.push(issue("error", "日期顺序冲突", `${field.label}早于${previous.label}。`));
    }
    if (differenceInDays(todayValue, value) > 0) {
      issues.push(issue("error", "填写了未来日期", `${field.label}是尚未发生的日期，请核对。`));
    }
    previous = { value, label: field.label };
  });
  return issues;
}

function buildIntervals(values) {
  const intervals = [];
  for (let index = 1; index < config.fields.length; index += 1) {
    const fromField = config.fields[index - 1];
    const toField = config.fields[index];
    const from = values[fromField.key];
    const to = values[toField.key];
    if (!from || !to || !parseDate(from) || !parseDate(to)) continue;
    const days = differenceInDays(from, to);
    intervals.push({
      id: `${fromField.key}-${toField.key}`,
      fromLabel: fromField.shortLabel,
      toLabel: toField.shortLabel,
      fromDate: formatChineseDate(from),
      toDate: formatChineseDate(to),
      duration: calendarDifference(from, to),
      days,
      daysText: days >= 0 ? `共 ${days} 天` : `倒序 ${Math.abs(days)} 天`,
      invalid: days < 0
    });
  }
  return intervals;
}

function getStage(values) {
  if (values.fullMemberDate) return { id: "full-member", name: "正式党员", index: 4 };
  if (values.probationDate) return { id: "probation", name: "预备党员阶段", index: 3 };
  if (values.targetDate) return { id: "target", name: "发展对象阶段", index: 2 };
  if (values.activistDate) return { id: "activist", name: "入党积极分子阶段", index: 1 };
  return { id: "applicant", name: "入党申请人阶段", index: 0 };
}

function buildStageAdvice(stage, values, todayValue) {
  const rules = config.rules;
  if (stage.id === "applicant") {
    const due = addMonths(values.applicationDate, rules.applicationTalk.months);
    const activistReference = addMonths(values.applicationDate, rules.applicationToActivist.months);
    return {
      action: "先核对是否已安排谈话，继续记录培养考察情况；满半年后结合上级党组织要求研究下一阶段事项。",
      suggestedTime: due ? `谈话参考截止日：${formatChineseDate(due)}；满半年参考日：${formatChineseDate(activistReference)}` : "收到申请书后一个月内安排谈话",
      timingStatus: due && differenceInDays(due, todayValue) > 0 ? "past" : "upcoming",
      notes: [rules.applicationToActivist.summary, "满半年只是时间参考条件，具体办理程序和材料要求请以上级党组织现行要求为准。"]
    };
  }
  if (stage.id === "activist") {
    const eligible = addYears(values.activistDate, rules.activistToTarget.years);
    const reached = eligible && differenceInDays(eligible, todayValue) >= 0;
    return {
      action: reached ? "培养考察时间已达到一年参考线，可结合上级党组织要求研究下一阶段事项。" : "继续做好培养教育和考察，并保存相关工作记录。",
      suggestedTime: `最早可研究确定发展对象参考日：${formatChineseDate(eligible)}`,
      timingStatus: reached ? "reached" : "upcoming",
      notes: ["达到一年只是时间参考条件之一，不代表可以自动成为发展对象；具体程序请以上级党组织现行要求为准。"]
    };
  }
  if (stage.id === "target") {
    return {
      action: "核对发展对象阶段所需程序、材料和办理记录，按上级党组织要求推进。",
      suggestedTime: "从确定发展对象到接收为预备党员的统一时间要求尚未确认，请勿仅凭本工具确定日期。",
      timingStatus: "pending",
      notes: ["本阶段暂无已确认的自动核算时限，请查阅现行规定并咨询上级党组织。"]
    };
  }
  if (stage.id === "probation") {
    const due = addYears(values.probationDate, rules.probationPeriod.years);
    const reached = due && differenceInDays(due, todayValue) >= 0;
    return {
      action: reached ? "预备期已满，请按上级党组织要求核对并办理转正相关事项。" : "继续做好预备党员教育考察，并按要求准备预备期满后的相关材料。",
      suggestedTime: `预备期满参考日：${formatChineseDate(due)}`,
      timingStatus: reached ? "past" : "upcoming",
      notes: ["预备期满参考日不等于自动转正日期，实际结果以组织决定和审批材料为准。"]
    };
  }
  return {
    action: "核对相关审批结果和材料归档情况，按上级党组织要求完成后续事项。",
    suggestedTime: "按实际审批结果和现行档案管理要求办理。",
    timingStatus: "complete",
    notes: ["本工具不对审批时限和其他后续时间要求作自动判断。"]
  };
}

function calculate(values, options = {}) {
  const todayValue = getTodayValue(options.today);
  const normalized = {};
  config.fields.forEach((field) => { normalized[field.key] = String(values[field.key] || ""); });

  const issues = validateSequence(normalized, todayValue);
  const rules = config.rules;

  if (normalized.applicationDate && normalized.activistDate && parseDate(normalized.applicationDate) && parseDate(normalized.activistDate)) {
    const reference = addMonths(normalized.applicationDate, rules.applicationToActivist.months);
    if (differenceInDays(normalized.activistDate, reference) > 0) {
      issues.push(issue("warning", "申请人培养考察未满半年", `按已确认的一般要求，满半年参考日为${formatChineseDate(reference)}；请结合特殊情况和上级党组织要求核对。`, rules.applicationToActivist.id));
    }
  }

  if (normalized.activistDate && normalized.targetDate && parseDate(normalized.activistDate) && parseDate(normalized.targetDate)) {
    const earliest = addYears(normalized.activistDate, rules.activistToTarget.years);
    if (differenceInDays(normalized.targetDate, earliest) > 0) {
      issues.push(issue("error", "积极分子培养考察时间不足一年", `按已填日期，最早参考日为${formatChineseDate(earliest)}；确定发展对象日期为${formatChineseDate(normalized.targetDate)}。`, rules.activistToTarget.id));
    }
  }

  if (normalized.probationDate && normalized.fullMemberDate && parseDate(normalized.probationDate) && parseDate(normalized.fullMemberDate)) {
    const due = addYears(normalized.probationDate, rules.probationPeriod.years);
    const comparison = differenceInDays(normalized.fullMemberDate, due);
    if (comparison > 0) {
      issues.push(issue("error", "预备期不足一年", `预备期满参考日为${formatChineseDate(due)}；所填转正生效日期早于该日期。`, rules.probationPeriod.id));
    } else if (comparison < 0) {
      issues.push(issue("warning", "转正时间晚于预备期满参考日", "请核对实际办理情况，并以组织决定、审批材料和上级党组织要求为准。", rules.probationExtension.id));
    }
  }

  const stage = getStage(normalized);
  const advice = buildStageAdvice(stage, normalized, todayValue);
  if (advice.timingStatus === "past" && stage.id !== "full-member") {
    issues.push(issue("warning", stage.id === "applicant" ? "谈话参考期限已到" : "预计办理节点已到", "系统无法确认相关程序是否已经完成，请结合工作记录核对。", stage.id === "applicant" ? rules.applicationTalk.id : rules.probationPeriod.id));
  }

  const errors = issues.filter((item) => item.level === "error");
  const warnings = issues.filter((item) => item.level === "warning");
  const status = errors.length ? "abnormal" : warnings.length ? "review" : "normal";
  const statusText = status === "abnormal" ? "存在明显时间冲突" : status === "review" ? "有事项需要核对" : "未发现明显时间冲突";

  return {
    calculatedAt: todayValue,
    configVersion: config.version,
    values: normalized,
    stage,
    intervals: buildIntervals(normalized),
    issues,
    status,
    statusText,
    advice,
    keyDates: config.fields.filter((field) => normalized[field.key]).map((field) => ({ label: field.shortLabel, value: formatChineseDate(normalized[field.key]) })),
    disclaimer: config.disclaimer
  };
}

module.exports = {
  config,
  parseDate,
  formatDate,
  formatChineseDate,
  addMonths,
  addYears,
  differenceInDays,
  calendarDifference,
  calculate
};
