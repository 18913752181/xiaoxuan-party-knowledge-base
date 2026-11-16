
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");

async function main() {
  const db = new PGlite();
  const user = "12345678-0000-0000-0000-000000000000";
  const other = "12345679-0000-0000-0000-000000000000";
  const one = "XM12345678901234567890";
  const pair = "XM12345678901234567891";
  const q = async (sql, ...args) => (await db.query(sql, args)).rows;
  const access = async (slug, u = user) => (await q("select material_purchase_access($1,$2) as v", u, slug))[0].v;
  const state = async (order, amount, tx, refund = false) => (await q("select set_material_purchase_status($1,$2,$3,now(),$4) as v",order,amount,tx,refund))[0].v;
  const redeem = async (slug) => (await q("select redeem_material_purchase($1,$2) as v", user, slug))[0].v;
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
    await q("insert into auth.users values($1),($2)",user,other);
    await db.exec(fs.readFileSync(path.join(__dirname,"../supabase/050_material_purchases.sql"),"utf8"));
    await q("insert into material_purchase_orders(out_trade_no,user_id,first_slug,amount_total) values($1,$2,'one',390),($3,$2,'pair',490)",one,user,pair);
    assert.deepEqual(await access("one"), { owned:false,remaining:0 });
    assert.equal(await state(one,490,"tx-1"),false);
    assert.equal(await state(one,390,"tx-1"),true);
    assert.deepEqual(await access("one"), { owned:true,remaining:0 });
    assert.equal(await state(pair,490,"tx-2"),true);
    assert.equal(await state(pair,490,"tx-2"),true);
    assert.deepEqual(await access("pair",other), { owned:false,remaining:0 });
    assert.deepEqual(await access("pair"), { owned:true,remaining:1 });
    assert.equal(await redeem("one"),true);
    assert.equal((await access("one")).remaining,1);
    const choices = await Promise.all([redeem("second-a"),redeem("second-b")]);
    assert.equal(choices.filter(Boolean).length,1);
    assert.equal((await access("pair")).remaining,0);
    const chosen = choices[0] ? "second-a" : "second-b";
    assert.equal(await redeem(chosen),true);
    assert.equal(await state(pair,490,null,true),true);
    assert.equal(await state(pair,490,"tx-2"),true);
    assert.deepEqual(await access(chosen), { owned:false,remaining:0 });
    assert.equal((await access("one")).owned,true);
    assert.equal((await q("select has_function_privilege('authenticated','redeem_material_purchase(uuid,text)','execute') as v"))[0].v,false);
    console.log("PASS: payment amount, idempotency, owner isolation, one-time redemption, repeat download, and full refund");
  } finally { await db.close(); }
}

main().catch((error)=>{ console.error(error); process.exitCode=1; });
