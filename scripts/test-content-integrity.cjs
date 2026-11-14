const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const ts = require("typescript");

async function main() {
  const project = path.join(__dirname, "..");
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "xiaoxuan-content-test-"));
  const cwd = process.cwd();
  try {
    process.chdir(sandbox);
    const slug = "2026-07-25-old-material";
    const dir = path.join(sandbox, "content", "测试专题", slug);
    await fs.mkdir(dir, { recursive: true });
    const metaPath = path.join(dir, "meta.json");
    const original = { slug, title: "历史资料的真实标题", category: "测试专题", isVip: true,
      createdAt: "2026-07-25T12:00:00.000Z", updatedAt: "2026-08-30T12:00:00.000Z", sortOrder: 86, downloadCount: 8, favoriteCount: 0 };
    await fs.writeFile(metaPath, JSON.stringify(original));
    const module = { exports: {} };
    const source = ts.transpileModule(await fs.readFile(path.join(project, "lib/content-units.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText;
    new Function("require", "module", "exports", source)(require, module, module.exports);
    const lib = module.exports;
    const increments = Array.from({ length: 30 }, () => lib.updateContentUnitCounter(slug, "downloadCount", 1));
    const reads = Array.from({ length: 60 }, async () => {
      for (let i = 0; i < 3; i++) {
        const units = await lib.listContentUnits();
        assert.equal(units.length, 1, "Atomic replacement must never expose a truncated metadata file");
        assert.equal(units[0].meta.title, original.title);
        assert.equal(units[0].meta.createdAt, original.createdAt);
      }
    });
    const outcomes = await Promise.allSettled([...increments, ...reads, lib.updateContentUnitOrder([slug]), lib.updateContentUnitMeta(slug, { pointsCost: 3 })]);
    for (const outcome of outcomes) if (outcome.status === "rejected") throw outcome.reason;
    const result = JSON.parse(await fs.readFile(metaPath, "utf8"));
    assert.equal(result.downloadCount, 38, "Concurrent increments must not overwrite each other");
    assert.equal(result.sortOrder, 0, "A counter update must preserve concurrent admin ordering");
    assert.equal(result.pointsCost, 3);
    for (const key of ["title", "isVip", "createdAt", "updatedAt"]) assert.equal(result[key], original[key], key);
    assert.equal((await lib.listContentUnits())[0].meta.downloadCount, 38, "Writes invalidate the list snapshot");
    await fs.writeFile(metaPath, "{");
    const before = await fs.readFile(metaPath, "utf8");
    const savedError = console.error;
    const now = Date.now;
    let offset = 6000;
    Date.now = () => now() + offset;
    console.error = () => {};
    try {
      assert.equal((await lib.listContentUnits()).length, 0, "Broken metadata must not become a newly published slug-title material");
      assert.equal(await lib.updateContentUnitCounter(slug, "favoriteCount", 1), null);
      assert.equal(await fs.readFile(metaPath, "utf8"), before, "A failed read must never overwrite the original file with defaults");
      await fs.writeFile(metaPath, JSON.stringify({ title: original.title, slug }));
      offset += 6000;
      const unit = (await lib.listContentUnits())[0];
      assert.equal(unit.meta.updatedAt, "2026-07-25T00:00:00.000Z", "External edits become visible after the snapshot expires");
      await lib.updateContentUnitMeta(slug, { status: "hidden" });
      assert.equal(await lib.getContentUnitBySlug(slug), null, "Hidden files are not returned from an earlier index");
      assert.equal((await lib.listContentUnits()).length, 0);
    } finally { console.error = savedError; Date.now = now; }
    console.log("PASS: atomic metadata, concurrent reads/counters/admin changes, preserved title/permissions/dates/order, invalid-read write protection");
  } finally {
    process.chdir(cwd);
    assert(sandbox.startsWith(path.join(os.tmpdir(), "xiaoxuan-content-test-")));
    await fs.rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
