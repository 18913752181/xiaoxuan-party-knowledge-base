const assert = require("assert");
const flow = require("../config/development-flow");
const { calculateTimeline, addWorkingDays, parseDate, formatDate } = require("../utils/development-flow-calculator");

assert.strictEqual(flow.stages.length, 7, "应展示 7 个阶段");
assert.strictEqual(flow.nodes.length, 51, "应完整保留 51 个节点");
assert.deepStrictEqual(flow.nodes.map((item) => item.sourceOrder), Array.from({ length: 51 }, (_, index) => index + 1), "节点序号必须连续");

flow.nodes.forEach((node, index) => {
  ["id", "stageId", "title", "timeRequirement", "prerequisite", "responsibleParties", "sourceMaterials", "requiredMaterials", "generatedMaterials", "timing"].forEach((key) => {
    assert.ok(Object.prototype.hasOwnProperty.call(node, key), `步骤 ${node.sourceOrder} 缺少 ${key}`);
  });
  assert.strictEqual(node.previousStep, index ? flow.nodes[index - 1].id : null);
  assert.strictEqual(node.nextStep, index < 50 ? flow.nodes[index + 1].id : null);
});

assert.deepStrictEqual(flow.nodes.slice(18, 21).map((item) => item.sourceOrder), [19, 20, 21], "第19—21项应按 Excel 当前时间顺序保留");
assert.strictEqual(flow.nodes[18].timing.anchorId, "step-18");
assert.strictEqual(flow.nodes[19].timing.anchorId, "step-19");
assert.strictEqual(flow.nodes[20].timing.anchorId, "step-20");

const fromApplication = calculateTimeline("step-01", "2026-01-01");
assert.ok(fromApplication.ok);
const applicationMap = Object.fromEntries(fromApplication.results.map((item) => [item.id, item.schedule]));
assert.strictEqual(applicationMap["step-02"].dateValue, "2026-02-01");
assert.strictEqual(applicationMap["step-03"].dateValue, "2026-07-01");
assert.strictEqual(applicationMap["step-15"].dateValue, "2027-07-01");

const fromProbation = calculateTimeline("step-33", "2026-01-01");
assert.ok(fromProbation.ok);
const probationMap = Object.fromEntries(fromProbation.results.map((item) => [item.id, item.schedule]));
assert.strictEqual(probationMap["step-35"].dateValue, "2026-01-11");
assert.strictEqual(probationMap["step-42"].dateValue, "2026-12-18");
assert.strictEqual(probationMap["step-43"].dateValue, "2027-01-01");
assert.strictEqual(probationMap["step-47"].dateValue, "2027-01-08");

assert.strictEqual(formatDate(addWorkingDays(parseDate("2026-08-14"), 5)), "2026-08-21", "五个工作日应跳过周末");
assert.strictEqual(calculateTimeline("missing", "2026-01-01").ok, false);
assert.strictEqual(calculateTimeline("step-01", "bad-date").ok, false);

console.log("development-flow tests passed");
