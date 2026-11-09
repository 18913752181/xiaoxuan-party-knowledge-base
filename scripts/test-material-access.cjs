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
    "@/lib/content-units": {
      getContentUnitDownloadFilePath: async (slug) => slug === "unpublished" ? null : { path: "test.pdf", file: { originalName: "same.pdf" } },
      updateContentUnitCounter: async () => { counters++; }
    },
    "fs/promises": {
      stat: async () => ({ size: fileSize }),
      readFile: async () => { reads++; return Buffer.from("%PDF-1.4"); }
    }
  };
  const download = load("app/api/content-units/[id]/download/route.ts", mocks).GET;
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
  const plans = load("lib/wechat-pay.ts", { "server-only": {} });
  assert.deepEqual(plans.membershipPlans().map((p) => p.code), ["annual"]);
  assert.equal(plans.membershipPlan("monthly"), null);
  assert.equal(plans.membershipPlan("quarterly"), null);
  console.log("PASS: both routes use the same verified entitlement, no daily or point limit, ZIP safety limits, annual-only checkout");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
