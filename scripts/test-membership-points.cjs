const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  new Function("require", "module", "exports", source)((id) => mocks[id] || require(id), module, module.exports);
  return module.exports;
}

function dateRange(start, end) {
  const dates = [];
  for (let date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

class PointModel {
  constructor() {
    this.balance = 0;
    this.keys = new Set();
    this.periods = [];
  }
  activate(order) {
    const key = `membership-order-bonus:${order.id}`;
    const bonus = order.plan === "monthly" ? 5 : order.plan === "quarterly" ? 20 : 0;
    if (bonus && !this.keys.has(key)) {
      this.keys.add(key);
      this.balance += bonus;
    }
    if (order.plan === "annual" && !this.periods.some((period) => period.orderId === order.id)) {
      this.periods.push({ orderId: order.id, start: order.start, end: order.end, revoked: false });
    }
  }
  refund(orderId) {
    for (const period of this.periods) if (period.orderId === orderId) period.revoked = true;
  }
  grantDaily(through) {
    for (const period of this.periods) {
      if (period.revoked || period.start > through) continue;
      const end = period.end < through ? period.end : through;
      for (const date of dateRange(period.start, end)) {
        const key = `annual-daily:user:${date}`;
        if (this.keys.has(key)) continue;
        this.keys.add(key);
        this.balance += 10;
      }
    }
  }
}

async function main() {
  const previousAnnual = process.env.DIMMO_ANNUAL_PRICE_CENTS;
  delete process.env.DIMMO_ANNUAL_PRICE_CENTS;
  const { membershipPlans } = load("lib/wechat-pay.ts", { "server-only": {}, fs: { readFileSync: () => "" } });
  const plans = membershipPlans();
  assert.deepEqual(plans.map((plan) => [plan.code, plan.amountTotal]), [["monthly", 2800], ["quarterly", 7900], ["annual", 9900]]);
  assert.deepEqual(plans.map((plan) => [plan.openingBonusPoints, plan.dailyPoints]), [[5, 0], [20, 0], [0, 10]]);
  if (previousAnnual === undefined) delete process.env.DIMMO_ANNUAL_PRICE_CENTS;
  else process.env.DIMMO_ANNUAL_PRICE_CENTS = previousAnnual;

  const model = new PointModel();
  model.activate({ id: "month-1", plan: "monthly" });
  model.activate({ id: "month-1", plan: "monthly" });
  assert.equal(model.balance, 5, "重复月卡支付回调只能赠送一次");
  model.activate({ id: "quarter-1", plan: "quarterly" });
  model.activate({ id: "quarter-1", plan: "quarterly" });
  assert.equal(model.balance, 25, "季度会员只增加一次 20 积分");

  model.activate({ id: "annual-1", plan: "annual", start: "2026-10-22", end: "2026-10-23" });
  model.grantDaily("2026-10-22");
  model.grantDaily("2026-10-22");
  assert.equal(model.balance, 35, "同一天重复定时执行只增加一次 10 积分");
  model.grantDaily("2026-10-24");
  assert.equal(model.balance, 45, "到期日发放，过期日停止");

  model.activate({ id: "annual-renewal", plan: "annual", start: "2026-11-01", end: "2026-11-02" });
  model.grantDaily("2026-10-31");
  assert.equal(model.balance, 45, "续费年卡在实际生效日前不提前发放");
  model.grantDaily("2026-11-01");
  assert.equal(model.balance, 55, "续费年卡生效后开始每日发放");
  model.refund("annual-renewal");
  model.grantDaily("2026-11-02");
  assert.equal(model.balance, 55, "退款后停止未来发放且不扣回已发积分");

  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase/045_membership_points.sql"), "utf8");
  assert.match(sql, /idempotency_key text not null unique/i);
  assert.match(sql, /on conflict \(idempotency_key\) do nothing/gi);
  assert.match(sql, /grant_due_annual_membership_points/);
  assert.match(sql, /least\(period\.ends_on, profile\.member_expires_at, v_through_date\)/);
  assert.match(sql, /coalesce\(o\.plan_code, 'annual'\) = 'annual'/);
  assert.match(sql, /greatest\(current_date, o\.member_expires_at - 365\)/);
  assert.match(sql, /not exists \([\s\S]*public\.membership_orders o[\s\S]*o\.status = 'paid'/);
  assert.match(sql, /when 'monthly' then 5[\s\S]*when 'quarterly' then 20/);
  assert.match(sql, /v_current_expiry \+ 1/);
  assert.doesNotMatch(sql, /protect_points_balance\(\)[\s\S]{0,100}security definer/i);

  const compose = fs.readFileSync(path.join(__dirname, "..", "compose.yaml"), "utf8");
  assert.match(compose, /membership-points\/grant-daily/);
  assert.match(compose, /setInterval\(points,3600000\)/);

  let grants = 0;
  process.env.REMINDER_CRON_SECRET = "test-secret";
  const route = load("app/api/internal/membership-points/grant-daily/route.ts", {
    "@/lib/membership-points": { grantDueAnnualMembershipPoints: async () => { grants += 1; return { grantedCount: 1, totalPoints: 10, updatedUsers: 1 }; } }
  });
  assert.equal((await route.POST(new Request("http://localhost", { method: "POST" }))).status, 401);
  const response = await route.POST(new Request("http://localhost", { method: "POST", headers: { authorization: "Bearer test-secret" } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).totalPoints, 10);
  assert.equal(grants, 1);

  console.log("PASS: plan prices, opening bonuses, annual daily grants, expiry, renewal, refund and idempotency");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
