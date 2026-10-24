const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
// Pass an installed @electric-sql/pglite module path as the first argument.
const { PGlite } = require(process.argv[2] || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create table public.profiles(id uuid primary key, email text, nickname text,
        member_status text default 'free', member_expires_at date, is_admin boolean default false,
        updated_at timestamptz default now());
      create table public.membership_orders(id uuid primary key default gen_random_uuid(),
        user_id uuid, email text, out_trade_no text unique, status text default 'pending',
        plan_code text, member_expires_at date, wechat_transaction_id text,
        paid_at timestamptz, raw_notification jsonb, updated_at timestamptz);
      insert into profiles(id,member_status,member_expires_at) values
        ('00000000-0000-0000-0000-000000000001','member',current_date + 30),
        ('00000000-0000-0000-0000-000000000002','free',null),
        ('00000000-0000-0000-0000-000000000003','member',current_date - 1);
      insert into auth.users select id, 'test@example.com', '{}' from profiles;
    `);
    const sql = name => fs.readFileSync(path.join(__dirname, '..', 'supabase', name), 'utf8');
    await db.exec(sql('045_membership_points.sql'));
    await db.exec(sql('046_material_point_unlocks.sql'));
    await db.exec("update profiles set points_balance = 30;");
    const migration = sql('047_legacy_membership_benefits.sql');
    await db.exec(migration);
    const query = async (q, args = []) => (await db.query(q, args)).rows;
    const old = '00000000-0000-0000-0000-000000000001';
    const fresh = '00000000-0000-0000-0000-000000000002';
    const expired = '00000000-0000-0000-0000-000000000003';
    const claim = async (user, items) => (await query('select unlock_materials_with_points($1,$2) as result', [user, JSON.stringify(items)]))[0].result;
    const balance = async user => (await query('select points_balance from profiles where id=$1',[user]))[0].points_balance;
    const activate = async (user, order, plan) => {
      await db.query('insert into membership_orders(user_id,out_trade_no,plan_code) values ($1,$2,$3)',[user,order,plan]);
      return query("select activate_membership_order($1,'tx',now(),'{}')",[order]);
    };
    assert.equal((await claim(old,[{slug:'one',cost:9},{slug:'two',cost:8}])).chargedPoints,0);
    assert.equal(await balance(old),30);
    assert.equal((await query('select count(*)::int n from material_point_unlocks'))[0].n,0,'Old members must not create artificial unlocks');
    await activate(old,'old-renew','annual');
    await query("select activate_membership_order('old-renew','tx',now(),'{}')");
    await query('select grant_due_annual_membership_points(current_date)');
    assert.equal(await balance(old),30,'Legacy renewal and daily job must leave original balance unchanged');
    await activate(fresh,'fresh-month','monthly');
    await query("select activate_membership_order('fresh-month','tx',now(),'{}')");
    assert.equal(await balance(fresh),35,'New monthly member gets the opening bonus once');
    await db.exec(migration);
    assert.equal((await query('select legacy_material_benefits from profiles where id=$1',[fresh]))[0].legacy_material_benefits,false,'Repeated migration must not grandfather new members');
    assert.equal((await claim(fresh,[{slug:'one',cost:1},{slug:'two',cost:2}])).chargedPoints,3);
    assert.equal((await claim(fresh,[{slug:'one',cost:99}])).chargedPoints,0);
    assert.equal(await balance(fresh),32);
    assert.equal((await claim(fresh,[{slug:'expensive',cost:99}])).code,'INSUFFICIENT_POINTS');
    assert.equal(await balance(fresh),32);
    await query('update profiles set member_expires_at=current_date-1 where id=$1',[old]);
    assert.equal((await claim(old,[{slug:'after-expiry',cost:1}])).chargedPoints,1,'Expired legacy members cannot use active-member exemptions');
    await activate(old,'old-return','quarterly');
    assert.equal((await claim(old,[{slug:'after-renewal',cost:20}])).chargedPoints,0,'Renewed original member keeps their identity');
    assert.equal((await query('select legacy_material_benefits from profiles where id=$1',[expired]))[0].legacy_material_benefits,false);
    await activate(fresh,'fresh-quarter','quarterly');
    await query("select activate_membership_order('fresh-quarter','tx',now(),'{}')");
    assert.equal(await balance(fresh),52,'Quarterly renewal adds exactly 20 points once');
    await activate(expired,'fresh-annual','annual');
    await query("select activate_membership_order('fresh-annual','tx',now(),'{}')");
    await query('select grant_due_annual_membership_points(current_date)');
    await query('select grant_due_annual_membership_points(current_date)');
    assert.equal(await balance(expired),40,'New annual member gets 10 points once per day');
    assert.equal(await balance(old),29,'Legacy member retains balance during daily grants to new members');
    const permission = await query("select has_function_privilege('service_role','public.unlock_materials_with_points_v1(uuid,jsonb)','execute') allowed");
    assert.equal(permission[0].allowed,false,'Service callers must use the grandfather-aware entry point');
    await db.exec('grant usage on schema public to authenticated; grant select, update, insert on profiles to authenticated; set role authenticated;');
    await assert.rejects(()=>db.query('update profiles set legacy_material_benefits=true where id=$1',[fresh]), /server_managed/);
    await db.exec('reset role;');
    console.log('PASS: real PostgreSQL migration, old/new members, renewal, expiry, repeated callbacks/migration, balance preservation and tamper protection');
  } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
