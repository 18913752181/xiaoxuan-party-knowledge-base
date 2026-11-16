const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const JSZip = require("jszip");

function load(file, mocks) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  new Function("require", "module", "exports", source)((id) => mocks[id] || require(id), module, module.exports);
  return module.exports;
}


async function main() {
  let user = { id: "session-user" };
  let canDownload = false;
  let unavailable = false;
  let fileSize = 8;
  let reads = 0;
  let counters = 0;
  let purchased = { owned: false, remaining: 0 };
  let redeemed = 0;
  const entitlementCalls = [];
  const mocks = {
    "@/lib/server-auth": {
      getServerSession: async () => user ? { user, refreshedTokens: {} } : null,
      applyAuthCookies: (response) => response.headers.set("X-Test-Refreshed", "true")
    },
    "@/lib/material-access": {
      getMaterialEntitlement: async (id) => {
        entitlementCalls.push(id);
        if (unavailable) throw Error("database unavailable");
        return { canDownload };
      },
      annualMembershipRequired: { error: "需要年卡", code: "ANNUAL_MEMBERSHIP_REQUIRED" }
    },
    "@/lib/material-purchase": {
      materialPurchaseAccess: async () => purchased,
      redeemMaterialPurchase: async () => { redeemed++; return true; }
    },
    "@/lib/content-units": {
      getContentUnitDownloadFilePath: async (slug) => slug === "unpublished" ? null : { path: "test.pdf", file: { originalName: "same.pdf" } },
      updateContentUnitCounter: async () => { counters++; }
    },
    "fs/promises": {
      access: async () => {},
      stat: async () => ({ size: fileSize }),
      readFile: async () => { reads++; return Buffer.from("%PDF-1.4"); }
    }
  };
  const route = load("app/api/content-units/[id]/download/route.ts", mocks);
  const download = route.GET;
  const batch = load("app/api/content-units/batch-download/route.ts", mocks).POST;
  const single = (slug) => download(new Request("http://localhost/download?expectedPoints=1"), { params: { id: slug } });
  const zipFiles = (slugs) => batch(new Request("http://localhost/batch", { method: "POST", body: JSON.stringify({ slugs, userId: "forged-user", expectedPoints: 0 }) }));
  const both = () => Promise.all([single("one"), zipFiles(["one"])]);
  user = null;
  assert.deepEqual((await both()).map((r) => r.status), [401, 401]);
  user = { id: "session-user" };
  const denied = await both();
  for (const response of denied) {
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("X-Test-Refreshed"), "true");
    assert.equal((await response.json()).code, "ANNUAL_MEMBERSHIP_REQUIRED");
  }
  assert.deepEqual(entitlementCalls, ["session-user", "session-user"]);
  assert.equal(reads, 0, "Rejected requests do not read any files");
  assert.equal(counters, 0);
  unavailable = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual((await both()).map((r) => r.status), [503, 503]);
  } finally {
    console.error = originalError;
  }
  unavailable = false;
  canDownload = true;
  assert.equal((await single("unpublished")).status, 404);
  assert.equal((await zipFiles(["one", "unpublished"])).status, 404);
  assert.equal(reads, 0);
  assert.equal((await zipFiles(Array(51).fill("one"))).status, 400);
  fileSize = 100 * 1024 * 1024 + 1;
  assert.equal((await zipFiles(["one"])).status, 413);
  fileSize = 8;
  for (let i = 0; i < 12; i++) {
    const file = await single("file-" + i);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("X-Material-Points-Charged"), null);
    assert.match(await file.text(), /^%PDF/);
  }
  const archive = await zipFiles(["content-one", "two", "one"]);
  assert.equal(archive.status, 200);
  assert.equal(archive.headers.get("X-Material-Daily-Remaining"), null);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ["same.pdf", "same (2).pdf"]);
  assert.equal(counters, 14);
  canDownload = false;
  const redeem = (id, unlockOnly = false) => route.POST(new Request("http://localhost/download", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redeem: true, unlockOnly })
  }), { params: { id } });
  purchased = { owned: false, remaining: 1 };
  assert.equal((await single("two")).status, 403);
  assert.equal((await redeem("unpublished")).status, 404);
  assert.equal(redeemed, 0, "Missing files and passive requests do not use a credit.");
  assert.equal((await redeem("two")).status, 200);
  purchased = { owned: true, remaining: 0 };
  assert.equal((await single("two")).status, 200);
  assert.equal(redeemed, 1);
  const direct = () => download(new Request("http://localhost/download?attachment=1"), { params: { id: "two" } });
  purchased = { owned: false, remaining: 1 };
  assert.equal((await direct()).status, 403, "Direct attachment requests must not spend a credit.");
  const beforeUnlock = reads;
  const unlocked = await redeem("two", true);
  assert.deepEqual(await unlocked.json(), { unlocked: true });
  assert.equal(reads, beforeUnlock, "Unlocking does not transfer the file.");
  purchased = { owned: true, remaining: 0 };
  const attachment = await direct();
  assert.equal(attachment.status, 200);
  assert.equal(attachment.headers.get("content-type"), "application/octet-stream");
  assert.match(attachment.headers.get("content-disposition"), /^attachment; filename="material\.pdf"; filename\*=UTF-8''same\.pdf$/);
  assert.match(await attachment.text(), /^%PDF/);
  assert.equal(redeemed, 2);
  process.env.MATERIAL_DOWNLOAD_TICKET_SECRET = "test-download-ticket-secret";
  const issue = () => route.POST(new Request("http://localhost/download", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ browserLink: true })
  }), { params: { id: "two" } });
  const useTicket = (ticket, id = "two") => download(new Request("http://localhost/download?ticket=" + ticket), { params: { id } });
  user = null;
  assert.equal((await issue()).status, 401);
  user = { id: "session-user" };
  purchased = { owned: false, remaining: 1 };
  assert.equal((await issue()).status, 403);
  purchased = { owned: true, remaining: 0 };
  const issued = await issue();
  assert.equal(issued.status, 200);
  assert.equal(issued.headers.get("Cache-Control"), "private, no-store");
  const { ticket } = await issued.json();
  user = null;
  assert.equal((await useTicket(ticket, "different")).status, 403);
  assert.equal((await useTicket((ticket[0] === "A" ? "B" : "A") + ticket.slice(1))).status, 403);
  const handedOff = await useTicket(ticket);
  assert.equal(handedOff.status, 200);
  assert.equal(handedOff.headers.get("X-Test-Refreshed"), null);
  assert.equal(handedOff.headers.get("Referrer-Policy"), "no-referrer");
  assert.equal(handedOff.headers.get("content-type"), "application/octet-stream");
  assert.equal(handedOff.headers.get("content-disposition"), attachment.headers.get("content-disposition"));
  assert.match(await handedOff.text(), /^%PDF/);
  purchased = { owned: false, remaining: 1 };
  assert.equal((await useTicket(ticket)).status, 403);
  purchased = { owned: true, remaining: 0 };
  const now = Date.now;
  Date.now = () => now() + 120_000;
  try {
    assert.equal((await useTicket(ticket)).status, 403);
  } finally {
    Date.now = now;
  }
  assert.equal(redeemed, 2, "Browser handoff never uses an extra credit.");
  const plans = load("lib/wechat-pay.ts", { "server-only": {} });
  assert.deepEqual(plans.membershipPlans().map((p) => p.code), ["annual"]);
  assert.equal(plans.membershipPlan("monthly"), null);
  assert.equal(plans.membershipPlan("quarterly"), null);
  console.log("PASS: both routes use the same verified entitlement, no daily or point limit, ZIP safety limits, annual-only checkout");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
