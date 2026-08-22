const flow = require("../config/development-flow");

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) return null;
  return date;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatChineseDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function cloneDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function addDays(date, days) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const targetMonth = date.getMonth() + months;
  const year = date.getFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  return new Date(year, month, Math.min(date.getDate(), daysInMonth(year, month)), 12, 0, 0, 0);
}

function addYears(date, years) {
  return addMonths(date, years * 12);
}

function addWorkingDays(date, workingDays) {
  let cursor = cloneDate(date);
  let added = 0;
  while (added < workingDays) {
    cursor = addDays(cursor, 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return cursor;
}

function quarterLabel(date) {
  return `${date.getFullYear()}年第${Math.floor(date.getMonth() / 3) + 1}季度`;
}

function pendingResult(node, reason) {
  return {
    nodeId: node.id,
    status: "pending",
    dateValue: "",
    dateText: "待确认",
    summary: reason || "流程资料未提供可直接换算的日期关系",
    basis: node.timeRequirement,
    lowerBound: false
  };
}

function datedResult(node, date, summary, status, lowerBound) {
  return {
    nodeId: node.id,
    status: status || "reference",
    dateValue: formatDate(date),
    dateText: formatChineseDate(date),
    summary,
    basis: node.timeRequirement,
    lowerBound: Boolean(lowerBound),
    internalDate: date
  };
}

function calculateNode(node, known) {
  const timing = node.timing || { type: "manual" };
  if (timing.type === "manual") return pendingResult(node);
  if (timing.type === "before") return pendingResult(node, "该节点要求在后续事项前完成，流程资料未给出可倒推的具体间隔");

  const anchor = known[timing.anchorId];
  if (!anchor || !anchor.internalDate) return pendingResult(node, "缺少可计算的前置节点日期，需结合实际办理进度确定");
  const source = anchor.internalDate;

  if (timing.type === "offsetMonths") {
    const date = addMonths(source, timing.months);
    return datedResult(node, date, timing.label || "最早参考日", "earliest", anchor.lowerBound);
  }
  if (timing.type === "offsetYears" || timing.type === "anniversary") {
    const date = addYears(source, timing.years);
    return datedResult(node, date, timing.label || "周年参考日", "earliest", anchor.lowerBound);
  }
  if (timing.type === "beforeAnniversary") {
    const date = addDays(addYears(source, timing.years), -timing.daysBefore);
    return datedResult(node, date, timing.label || "办理参考日", "reference", anchor.lowerBound);
  }
  if (timing.type === "deadlineMonths" || timing.type === "advisoryDeadlineMonths") {
    const date = addMonths(source, timing.months);
    return datedResult(node, date, timing.label || "截止参考日", timing.type === "advisoryDeadlineMonths" ? "advisory" : "deadline", anchor.lowerBound);
  }
  if (timing.type === "deadlineDays") {
    const date = addDays(source, timing.days);
    return datedResult(node, date, timing.label || "截止参考日", "deadline", anchor.lowerBound);
  }
  if (timing.type === "sameDay") {
    return datedResult(node, source, anchor.lowerBound ? "不早于此前参考日期，实际日期待安排" : "可与前置节点同日开展", anchor.lowerBound ? "condition" : "earliest", anchor.lowerBound);
  }
  if (timing.type === "sameMonth") {
    return datedResult(node, source, `从${source.getFullYear()}年${source.getMonth() + 1}月起办理`, "reference", anchor.lowerBound);
  }
  if (timing.type === "sameQuarter") {
    return datedResult(node, source, `从${quarterLabel(source)}开始`, "reference", anchor.lowerBound);
  }
  if (timing.type === "recurringMonths") {
    const date = addMonths(source, timing.months);
    const repeat = timing.repeatMonths ? `，此后每${timing.repeatMonths}个月一次` : `，此后按“${node.timeRequirement}”执行`;
    return datedResult(node, date, `${timing.label || "首次参考日"}${repeat}`, "reference", anchor.lowerBound);
  }
  if (timing.type === "afterWorkingDays") {
    const date = addWorkingDays(source, timing.workingDays);
    return datedResult(node, date, `${timing.label || "条件满足参考日"}；仅排除周六、周日，法定节假日和调休需人工核对`, "condition", true);
  }
  if (timing.type === "after") {
    const duration = timing.durationWorkingDays ? `；该节点事项需持续${timing.durationWorkingDays}个工作日` : "";
    return datedResult(node, source, `不早于该日期之后，具体日期待组织安排${duration}`, "condition", true);
  }
  if (timing.type === "event") {
    return datedResult(node, source, "不早于此前条件完成日，具体以实际会议日期为准", "condition", true);
  }
  return pendingResult(node);
}

function calculateTimeline(nodeId, dateValue) {
  const selectedIndex = flow.nodes.findIndex((item) => item.id === nodeId);
  const inputDate = parseDate(dateValue);
  if (selectedIndex < 0 || !inputDate) return { ok: false, error: "请选择流程节点并填写有效日期。", results: [] };

  const selected = flow.nodes[selectedIndex];
  const known = {};
  known[selected.id] = datedResult(selected, inputDate, "用户填写的已知节点日期", "known", false);

  for (let pass = 0; pass < flow.nodes.length; pass += 1) {
    let changed = false;
    flow.nodes.slice(selectedIndex + 1).forEach((node) => {
      if (known[node.id] && known[node.id].status !== "pending") return;
      const result = calculateNode(node, known);
      if (result.status !== "pending") {
        known[node.id] = result;
        changed = true;
      } else if (!known[node.id]) {
        known[node.id] = result;
      }
    });
    if (!changed) break;
  }

  const results = flow.nodes.slice(selectedIndex).map((node) => {
    const result = known[node.id] || pendingResult(node);
    const clean = Object.assign({}, result);
    delete clean.internalDate;
    return Object.assign({}, node, { schedule: clean });
  });

  return {
    ok: true,
    selectedNode: selected,
    selectedDate: formatDate(inputDate),
    selectedStageId: selected.stageId,
    results,
    calculableCount: results.filter((item) => item.schedule.status !== "pending").length,
    pendingCount: results.filter((item) => item.schedule.status === "pending").length
  };
}

module.exports = {
  flow,
  parseDate,
  formatDate,
  addDays,
  addMonths,
  addYears,
  addWorkingDays,
  calculateTimeline
};
