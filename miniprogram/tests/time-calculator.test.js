const assert = require("assert");
const { addYears, calculate, formatDate } = require("../utils/time-calculator");

const TODAY = "2030-01-01";

function values(overrides) {
  return {
    applicationDate: "2024-01-01",
    activistDate: "2024-07-01",
    targetDate: "2025-07-01",
    probationDate: "2026-01-01",
    fullMemberDate: "2027-01-01",
    ...overrides
  };
}

function hasIssue(result, title) {
  return result.issues.some((item) => item.title === title);
}

assert.strictEqual(formatDate(addYears("2026-01-01", 1)), "2027-01-01", "周年应保持月日");
assert.strictEqual(formatDate(addYears("2024-02-29", 1)), "2025-02-28", "闰日周年按目标月末处理");

const standard = calculate(values({}), { today: TODAY });
assert.strictEqual(standard.stage.id, "full-member");
assert.strictEqual(standard.status, "normal");
assert.strictEqual(hasIssue(standard, "预备期不足一年"), false);

const shortApplicantPeriod = calculate(values({ activistDate: "2024-06-30", targetDate: "2025-06-30" }), { today: TODAY });
assert.strictEqual(hasIssue(shortApplicantPeriod, "申请人培养考察未满半年"), true);
assert.strictEqual(shortApplicantPeriod.status, "review", "一般满半年应为核对项而非明确异常");

const shortActivistPeriod = calculate(values({ targetDate: "2025-06-30" }), { today: TODAY });
assert.strictEqual(hasIssue(shortActivistPeriod, "积极分子培养考察时间不足一年"), true);
assert.strictEqual(shortActivistPeriod.status, "abnormal");

const earlyFullMember = calculate(values({ fullMemberDate: "2026-12-31" }), { today: TODAY });
assert.strictEqual(hasIssue(earlyFullMember, "预备期不足一年"), true);
assert.strictEqual(earlyFullMember.status, "abnormal");

const lateFullMember = calculate(values({ fullMemberDate: "2027-01-02" }), { today: TODAY });
assert.strictEqual(hasIssue(lateFullMember, "转正时间晚于预备期满参考日"), true);
assert.strictEqual(lateFullMember.status, "review");

const applicant = calculate(values({ activistDate: "", targetDate: "", probationDate: "", fullMemberDate: "" }), { today: "2024-02-01" });
assert.strictEqual(applicant.stage.id, "applicant");
assert.ok(applicant.advice.suggestedTime.includes("2024年7月1日"), "应显示满半年参考日");

const skipped = calculate(values({ activistDate: "", targetDate: "2025-07-01" }), { today: TODAY });
assert.strictEqual(hasIssue(skipped, "阶段日期不完整"), true);

console.log("time-calculator: all tests passed");
