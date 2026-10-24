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

async function main() {
  const rpcCalls = [];
  const service = load("lib/material-points.ts", {
    "server-only": {},
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async (name, args) => {
          rpcCalls.push([name, args]);
          return { data: { ok: true, chargedPoints: 3, pointsBalance: 7, unlockedSlugs: ["one", "two"] }, error: null };
        }
      })
    }
  });

  const result = await service.claimMaterialPoints("user", [
    { slug: "one", cost: 1 },
    { slug: "one", cost: 1 },
    { slug: "two", cost: 2 },
    { slug: "invalid", cost: -1 }
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.chargedPoints, 3);
  assert.deepEqual(rpcCalls, [[
    "unlock_materials_with_points",
    { p_user_id: "user", p_materials: [{ slug: "one", cost: 1 }, { slug: "two", cost: 2 }] }
  ]]);

  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "046_material_point_unlocks.sql"), "utf8");
  assert.match(sql, /unique \(user_id, material_slug\)/i, "Each account/material pair must unlock once");
  assert.match(sql, /for update/i, "Balance updates must serialize concurrent claims");
  assert.match(sql, /INSUFFICIENT_POINTS/, "Insufficient balance must be returned without deduction");
  assert.match(sql, /points_balance = points_balance - v_charged/i, "Successful claims deduct the exact new unlock total");
  assert.match(sql, /on conflict \(user_id, material_slug\) do nothing/i, "Repeated requests must remain idempotent");

  const contentUnits = fs.readFileSync(path.join(__dirname, "..", "lib", "content-units.ts"), "utf8");
  assert.match(contentUnits, /normalizeMaterialPointsCost\(meta\.pointsCost\)/, "Existing materials default through the price normalizer");
  assert.match(contentUnits, /normalizeMaterialPointsCost\(input\.pointsCost\)/, "New uploads persist a default price");

  console.log("PASS: material point defaults, atomic deduction, insufficient balance and repeat-download idempotency");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
