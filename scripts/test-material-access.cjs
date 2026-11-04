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
  let memberOnly = true;
  let membershipActive = false;
  let membershipUnavailable = false;
  let membershipCalls = 0;
  let reads = 0;
  let counters = 0;
  let pointClaim = { ok: true, chargedPoints: 1, pointsBalance: 9, unlockedSlugs: ["same-material"] };
  const pointClaims = [];
  const calls = [];
  const mocks = {
    "@/lib/server-auth": { getServerSession: async () => signedIn ? { user: { id: "user" }, accessToken: "token" } : null, applyAuthCookies: () => {} },
    "@/lib/material-access": {
      authorizeMaterialAccess: async (...args) => { calls.push(args); if (unavailable) throw Error("Database unavailable"); return decision; },
      materialAccessMessage: (access) => access.code
    },
    "@/lib/membership": {
      getMembership: async () => {
        membershipCalls++;
        if (membershipUnavailable) throw Error("Membership unavailable");
        return { active: membershipActive };
      }
    },
    "@/lib/material-point-state": { getMaterialPointState: async () => ({ paid: true, legacyBenefits: false, pointsBalance: 9, unlockedSlugs: [] }) },
    "@/lib/material-point-view": load("lib/material-point-view.ts", {}),
    "@/lib/material-download-message": load("lib/material-download-message.ts", {}),
    "@/lib/material-points": {
      claimMaterialPoints: async (...args) => { pointClaims.push(args); return pointClaim; }
    },
    "@/lib/content-units": {
      getContentUnitBySlug: async (slug) => ({ meta: { isVip: memberOnly, slug, pointsCost: 1 } }),
      getContentUnitDownloadFilePath: async () => missing ? null : { path: "test.pdf", file: { originalName: "same.pdf" }, title: "Test" },
      updateContentUnitCounter: async () => { counters++; }
    },
    "fs/promises": { stat: async () => ({ size: 8 }), readFile: async () => { reads++; return Buffer.from("%PDF-1.4"); } }
  };
  const download = load("app/api/content-units/[id]/download/route.ts", mocks).GET;
  const batch = load("app/api/content-units/batch-download/route.ts", mocks).POST;
  const req = new Request("http://localhost/test");
  const context = { params: { id: "content-same-material" } };
  let response;
  const callsBeforePublicDownload = calls.length;
  memberOnly = false;
  response = await download(req, context);
  assert.equal(response.status, 200, "Ordinary materials remain downloadable with the configured points");
  assert.equal(response.headers.get("X-Material-Points-Charged"), "1");
  assert.equal(response.headers.get("X-Material-Points-Balance"), "9");
  assert.equal(calls.length, callsBeforePublicDownload, "Ordinary downloads must not use batch membership access");
  assert.equal(membershipCalls, 0, "Ordinary downloads do not need a paid membership lookup");
  assert.deepEqual(pointClaims.at(-1), ["user", [{ slug: "same-material", cost: 1 }], undefined], "A first download claims the configured points atomically");
  response = await download(new Request("http://localhost/test?expectedPoints=1"),context);
  assert.equal(pointClaims.at(-1)[2],1,"Confirmed single-download prices reach the atomic claim");
  assert.equal((await download(new Request("http://localhost/test?expectedPoints=-1"),context)).status,400);
  pointClaim = { ok: false, code: "INSUFFICIENT_POINTS", requiredPoints: 1, chargedPoints: 0, pointsBalance: 0, unlockedSlugs: [] };
  response = await download(req, context);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "INSUFFICIENT_POINTS");
  pointClaim = { ok:false,code:"DAILY_DOWNLOAD_LIMIT",chargedPoints:0,pointsBalance:9,unlockedSlugs:[],dailyLimit:10,dailyUsed:10,dailyRemaining:0,requestedNew:1 };
  response = await download(req,context);
  assert.equal(response.status,403);
  assert.equal((await response.json()).dailyRemaining,0);
  pointClaim = { ok:false,code:"ANNUAL_MEMBERSHIP_REQUIRED",chargedPoints:0,pointsBalance:9,unlockedSlugs:[] };
  response = await download(req,context);
  assert.equal((await response.json()).code,"ANNUAL_MEMBERSHIP_REQUIRED");
  pointClaim = { ok: true, chargedPoints: 0, pointsBalance: 9, unlockedSlugs: [] };
  memberOnly = true;
  const beforeCounters = counters;
  response = await download(req, context);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "MEMBERSHIP_REQUIRED");
  assert.equal(counters, beforeCounters, "Rejected member-only downloads must not increment counters");
  membershipActive = true;
  assert.equal((await download(req, context)).status, 200, "Paid members may download member-only materials");
  membershipUnavailable = true;
  assert.equal((await download(req, context)).status, 503, "Membership lookup failure must deny member-only downloads");
  membershipUnavailable = false;
  memberOnly = false;
  missing = true;
  assert.equal((await download(req, context)).status, 404);
  missing = false;
  const batchRequest = (slugs, expectedPoints) => new Request("http://localhost/batch", { method: "POST", body: JSON.stringify({ slugs, expectedPoints }), headers: { "Content-Type": "application/json" } });
  decision = { allowed: false, code: "BATCH_MEMBERSHIP_REQUIRED" };
  const beforeReads = reads;
  assert.equal((await batch(batchRequest(["one"]))).status, 403);
  assert.equal(reads, beforeReads, "Free batch requests must be denied before reading files");
  assert.deepEqual(calls.at(-1), ["token", null, true, "user"]);
  decision = { allowed: true, paid: true };
  pointClaim = { ok: false, code: "POINTS_QUOTE_CHANGED", requiredPoints: 2, chargedPoints: 0, pointsBalance: 9, unlockedSlugs: [] };
  const claimsBeforeStaleQuote = pointClaims.length;
  response = await batch(batchRequest(["one", "two"], 1));
  assert.equal(response.status, 409, "An increased batch price requires fresh confirmation");
  assert.equal(pointClaims.length, claimsBeforeStaleQuote + 1, "The database validates confirmed prices atomically");
  assert.equal(pointClaims.at(-1)[2],1);
  pointClaim = { ok: true, chargedPoints: 0, pointsBalance: 9, unlockedSlugs: [] };
  const archive = await batch(batchRequest(["one", "two", "one"]));
  assert.equal(archive.status, 200);
  assert.equal(archive.headers.get("X-Material-Points-Charged"), "0");
  assert.equal(archive.headers.get("X-Material-Points-Balance"), "9");
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ["same.pdf", "same (2).pdf"]);
  assert.equal((await batch(batchRequest(Array(51).fill("one")))).status, 400);
  signedIn = false;
  for (const route of [download]) assert.equal((await route(req, context)).status, 401);
  assert.equal((await batch(batchRequest(["one"]))).status, 401);
  let paid = true;
  let membershipFailure = false;
  const accessService = load("lib/material-access.ts", {
    "server-only": {},
    "@/lib/material-point-state": { getMaterialPointState: async () => ({policy:"legacy_points"}) },
    "@/lib/membership": { getMembership: async () => { if (membershipFailure) throw Error("Membership unavailable"); return { active: paid }; } }
  });
  for (const [slug, isBatch] of [[null, false], ["one", false], [null, true]]) {
    assert.equal((await accessService.authorizeMaterialAccess("token", slug, isBatch, "user")).paid, true);
  }
  paid = false;
  assert.equal((await accessService.authorizeMaterialAccess("token", null, true, "user")).allowed, false);
  assert.equal((await accessService.authorizeMaterialAccess("token", null, false, "user")).paid, false);
  membershipFailure = true;
  await assert.rejects(() => accessService.authorizeMaterialAccess("token", "one", false, "user"));
  console.log("PASS: point-gated downloads, member-only enforcement, paid-only ZIP and failure handling");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
