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
  let signedIn = true;
  let decision = { allowed: true, paid: false };
  let unavailable = false;
  let missing = false;
  let reads = 0;
  let counters = 0;
  const calls = [];
  const mocks = {
    "@/lib/server-auth": { getServerSession: async () => signedIn ? { user: { id: "user" }, accessToken: "token" } : null, applyAuthCookies: () => {} },
    "@/lib/material-access": {
      authorizeMaterialAccess: async (...args) => { calls.push(args); if (unavailable) throw Error("Database unavailable"); return decision; },
      materialAccessMessage: (access) => access.code
    },
    "@/lib/content-units": {
      getContentUnitBySlug: async (slug) => ({ meta: { isVip: true, slug } }),
      getContentUnitDownloadFilePath: async () => missing ? null : { path: "test.pdf", file: { originalName: "same.pdf" }, title: "Test" },
      updateContentUnitCounter: async () => { counters++; }
    },
    "@/lib/material-preview": { createMaterialPreview: async () => ({}) },
    "fs/promises": { stat: async () => ({ size: 8 }), readFile: async () => { reads++; return Buffer.from("%PDF-1.4"); } }
  };
  const preview = load("app/api/content-units/[id]/preview/route.ts", mocks).GET;
  const download = load("app/api/content-units/[id]/download/route.ts", mocks).GET;
  const batch = load("app/api/content-units/batch-download/route.ts", mocks).POST;
  const req = new Request("http://localhost/test");
  const context = { params: { id: "content-same-material" } };
  for (const route of [preview, download]) {
    assert.equal((await route(req, context)).status, 200, "Old VIP flags must not block a free user's available slot");
    assert.deepEqual(calls.at(-1), ["token", "same-material", false, "user"], "Preview and download use the same canonical quota key and verified identity");
  }
  decision = { allowed: false, code: "MATERIAL_QUOTA_EXCEEDED" };
  const beforeCounters = counters;
  for (const route of [preview, download]) {
    const response = await route(req, context);
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "MATERIAL_QUOTA_EXCEEDED");
  }
  assert.equal(counters, beforeCounters, "Rejected downloads must not increment counters");
  unavailable = true;
  for (const route of [preview, download]) assert.equal((await route(req, context)).status, 503, "Database failure must never grant access");
  unavailable = false;
  missing = true;
  const beforeCalls = calls.length;
  for (const route of [preview, download]) assert.equal((await route(req, context)).status, 404);
  assert.equal(calls.length, beforeCalls, "Missing files must not consume quota");
  missing = false;
  const batchRequest = (slugs) => new Request("http://localhost/batch", { method: "POST", body: JSON.stringify({ slugs }), headers: { "Content-Type": "application/json" } });
  decision = { allowed: false, code: "BATCH_MEMBERSHIP_REQUIRED" };
  const beforeReads = reads;
  assert.equal((await batch(batchRequest(["one"]))).status, 403);
  assert.equal(reads, beforeReads, "Free batch requests must be denied before reading files");
  assert.deepEqual(calls.at(-1), ["token", null, true, "user"]);
  decision = { allowed: true, paid: true };
  const archive = await batch(batchRequest(["one", "two", "one"]));
  assert.equal(archive.status, 200);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ["same.pdf", "same (2).pdf"]);
  assert.equal((await batch(batchRequest(Array(51).fill("one")))).status, 400);
  signedIn = false;
  for (const route of [preview, download]) assert.equal((await route(req, context)).status, 401);
  assert.equal((await batch(batchRequest(["one"]))).status, 401);
  let paid = true;
  let membershipFailure = false;
  let rpcCalls = 0;
  const accessService = load("lib/material-access.ts", {
    "server-only": {},
    "@/lib/membership": { getMembership: async () => { if (membershipFailure) throw Error("Membership unavailable"); return { active: paid }; } },
    "@/lib/material-quota-store": { claimMaterialQuota: async () => { rpcCalls++; throw Error("Quota storage unavailable"); } }
  });
  for (const [slug, isBatch] of [[null, false], ["one", false], [null, true]]) {
    assert.equal((await accessService.authorizeMaterialAccess("token", slug, isBatch, "user")).paid, true);
  }
  assert.equal(rpcCalls, 0, "Paid access must work without free quota migration");
  paid = false;
  assert.equal((await accessService.authorizeMaterialAccess("token", null, true, "user")).allowed, false);
  await assert.rejects(() => accessService.authorizeMaterialAccess("token", "one", false, "user"));
  membershipFailure = true;
  await assert.rejects(() => accessService.authorizeMaterialAccess("token", "one", false, "user"));
  console.log("PASS: shared quota delegation, free/VIP-file access, quota denial, failure handling, paid-only ZIP and duplicate filenames");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
