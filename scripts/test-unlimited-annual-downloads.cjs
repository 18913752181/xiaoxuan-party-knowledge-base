const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");

async function main() {
  const db = new PGlite();
  const id = (n) => "00000000-0000-0000-0000-00000000000" + n;
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const migration = (name) => db.exec(fs.readFileSync(path.join(__dirname, "..", "supabase", name), "utf8"));
  const activate = (order) => query("select activate_membership_order($1, $1, now(), '{}'::jsonb) as expiry", [order]);
  const access = async (n) => (await query("select material_download_entitlement($1) as access", [id(n)]))[0].access;
  const addOrder = (n, order, plan) => query("insert into membership_orders(user_id,out_trade_no,plan_code,amount_total) values ($1,$2,$3,9900)", [id(n), order, plan]);
  const refund = (order) => query("select refund_membership_order($1,9900,'{}'::jsonb)", [order]);
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
        plan_code text, member_expires_at date, wechat_transaction_id text, amount_total integer,
        paid_at timestamptz, raw_notification jsonb, updated_at timestamptz);
      insert into auth.users
        select ('00000000-0000-0000-0000-00000000000' || i)::uuid, 'test@example.com', '{}' from generate_series(1,7) i;
      insert into profiles(id,member_status,member_expires_at)
        select id, case when id = '${id(1)}' then 'member' else 'free' end,
        case when id = '${id(1)}' then current_date + 30 end from auth.users;
    `);
    await migration("045_membership_points.sql");
    await migration("046_material_point_unlocks.sql");
    await migration("047_legacy_membership_benefits.sql");
    // A member who joined during the points era is also grandfathered.
    await db.exec(`update profiles set member_status='member',member_expires_at=current_date+30,points_balance=17 where id='${id(2)}'`);
    await migration("048_annual_material_downloads.sql");
    await addOrder(3, "existing-annual", "annual");
    await activate("existing-annual");
    await addOrder(4, "existing-month", "monthly");
    await activate("existing-month");
    await addOrder(5, "pending-quarter", "quarterly");
    await addOrder(6, "new-annual", "annual");
    await addOrder(7, "new-annual-refund", "annual");
    const history = async () => ({
      balances: await query("select id,points_balance from profiles order by id"),
      ledger: await query("select id,amount from point_transactions order by id")
    });
    const snapshot = await history();
    await migration("049_unlimited_annual_material_downloads.sql");
    await migration("049_unlimited_annual_material_downloads.sql");
    for (const n of [1, 2, 3]) assert.equal((await access(n)).canDownload, true, "Previously entitled members keep access");
    assert.equal((await access(4)).canDownload, false, "A monthly term is not an annual term");
    assert.equal((await access(6)).canDownload, false, "An unpaid annual order grants nothing");
    await activate("pending-quarter");
    assert.equal((await access(5)).memberActive, true, "An outstanding quarter order still activates");
    assert.equal((await access(5)).canDownload, false);
    const first = await activate("new-annual");
    assert.deepEqual(await activate("new-annual"), first, "Repeated callback does not extend again");
    assert.equal((await access(6)).canDownload, true);
    await addOrder(6, "annual-renewal", "annual");
    await activate("annual-renewal");
    assert.equal((await access(6)).canDownload, true);
    assert.equal((await query("select count(*)::int as n from annual_material_memberships where user_id=$1",[id(6)]))[0].n, 2);
    await refund("annual-renewal");
    assert.equal((await access(6)).downloadExpiresAt, first[0].expiry.toISOString().slice(0, 10), "Refunding the renewal preserves the original annual term");
    await addOrder(7, "existing-quarter", "quarterly");
    await activate("existing-quarter");
    await activate("new-annual-refund");
    await refund("new-annual-refund");
    await refund("new-annual-refund");
    assert.equal((await access(7)).memberActive, true, "Other paid membership survives the refund");
    assert.equal((await access(7)).canDownload, false, "A refunded annual term cannot grant access");
    await assert.rejects(() => activate("new-annual-refund"), /refunded/);
    await query("update profiles set member_expires_at=current_date-1 where id=$1",[id(3)]);
    assert.equal((await access(3)).canDownload, false);
    const claim = (await query("select claim_material_downloads($1,'[]'::jsonb,1) as claim",[id(6)]))[0].claim;
    assert.equal(claim.ok, true);
    assert.equal(claim.chargedPoints, 0, "A previous client cannot debit points");
    await query("select grant_due_annual_membership_points()");
    assert.deepEqual(await history(), snapshot, "No points are minted, consumed or deleted");
    assert.equal((await query("select has_function_privilege('authenticated','public.material_download_entitlement(uuid)','EXECUTE') as allowed"))[0].allowed,false);
    await db.exec("grant select,update on profiles to authenticated; set role authenticated");
    await assert.rejects(() => query("update profiles set member_expires_at=current_date+800 where id=$1",[id(1)]), /server_managed/);
    await db.exec("reset role");
    console.log("PASS: annual-only purchases, grandfathering, renewals, refunds, expiry, write protection, and unchanged balances");
  } finally {
    await db.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
