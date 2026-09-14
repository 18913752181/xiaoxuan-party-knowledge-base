const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/material-quota-store.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', source)(require, loaded, loaded.exports);
const { claimMaterialQuota } = loaded.exports;
async function main() {
  if (process.argv[2] === 'child') {
    console.log(JSON.stringify(await claimMaterialQuota('test-user', process.argv[4], process.argv[3])));
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'material-quota-'));
  const run = async (slug) => JSON.parse((await promisify(execFile)(process.execPath, [__filename, 'child', root, slug])).stdout);
  const results = await Promise.all(Array.from({ length: 9 }, (_, i) => run(`document-${i}`)));
  assert.equal(results.filter((item) => item.allowed).length, 5, 'Parallel processes must never exceed five grants');
  const record = JSON.parse(fs.readFileSync(path.join(root, fs.readdirSync(root).find((name) => name.endsWith('.json'))), 'utf8'));
  assert.equal(record.slugs.length, 5);
  assert.equal((await run(record.slugs[0])).allowed, true, 'Repeat access must survive process restart');
  assert.equal((await run('sixth-document')).allowed, false);
  const repeats = await Promise.all(Array.from({ length: 8 }, () => claimMaterialQuota('repeat-user', 'same', root)));
  assert(repeats.every((item) => item.allowed && item.used === 1), 'Same document must only count once under concurrency');
  const status = await claimMaterialQuota('repeat-user', null, root);
  assert.equal(status.used, 1);
  assert.equal((await claimMaterialQuota('another-user', null, root)).used, 0);
  console.log('PASS: concurrent processes capped at five, duplicate deduplication, restart persistence and account isolation');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
