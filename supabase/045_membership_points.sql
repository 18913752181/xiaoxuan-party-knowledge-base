begin;

-- 积分余额只做增量扩展，不改动现有会员状态、到期日和历史订单。
alter table public.profiles add column if not exists points_balance integer;
update public.profiles set points_balance = 0 where points_balance is null;
alter table public.profiles alter column points_balance set default 0;
alter table public.profiles alter column points_balance set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_points_balance_nonnegative'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_points_balance_nonnegative check (points_balance >= 0);
  end if;
end
$$;

-- 每次赠送均保留不可重复的业务键。页面刷新、重复回调和定时任务并发
-- 都会命中同一个 idempotency_key，从数据库层阻止重复赠送。
create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount <> 0),
  event_type text not null check (event_type in ('membership_opening_bonus', 'annual_daily')),
  reference_order_id uuid references public.membership_orders(id) on delete restrict,
  grant_date date,
  idempotency_key text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists point_transactions_user_created_idx
  on public.point_transactions(user_id, created_at desc);

-- 年卡每日积分只在对应年卡实际生效区间内发放。
create table if not exists public.annual_membership_point_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_order_id uuid references public.membership_orders(id) on delete restrict,
  source_key text not null unique,
  starts_on date not null,
  ends_on date not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists annual_membership_point_periods_due_idx
  on public.annual_membership_point_periods(starts_on, ends_on)
  where revoked_at is null;
create index if not exists annual_membership_point_periods_user_idx
  on public.annual_membership_point_periods(user_id, ends_on desc);

alter table public.point_transactions enable row level security;
alter table public.annual_membership_point_periods enable row level security;

revoke all on public.point_transactions from anon, authenticated;
grant select on public.point_transactions to authenticated;
drop policy if exists "Users can read own point transactions" on public.point_transactions;
create policy "Users can read own point transactions"
on public.point_transactions for select to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
);

revoke all on public.annual_membership_point_periods from anon, authenticated;

-- 旧站曾允许用户更新自己的 profiles 基础资料；积分余额必须只能由受信函数修改。
create or replace function public.protect_points_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.points_balance is distinct from old.points_balance
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'points_balance_is_server_managed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profiles_points_balance on public.profiles;
create trigger protect_profiles_points_balance
before update of points_balance on public.profiles
for each row execute function public.protect_points_balance();

-- 支付成功与会员延期、套餐积分赠送在同一数据库事务中完成。
create or replace function public.activate_membership_order(
  p_out_trade_no text,
  p_transaction_id text,
  p_paid_at timestamptz,
  p_raw_notification jsonb
) returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.membership_orders%rowtype;
  v_current_expiry date;
  v_new_expiry date;
  v_period_start date;
  v_duration_days integer;
  v_bonus_points integer;
  v_inserted_points integer;
begin
  select * into v_order
  from public.membership_orders
  where out_trade_no = p_out_trade_no
  for update;

  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'paid' then return v_order.member_expires_at; end if;

  v_duration_days := case v_order.plan_code
    when 'monthly' then 30
    when 'quarterly' then 90
    else 365
  end;
  v_bonus_points := case v_order.plan_code
    when 'monthly' then 5
    when 'quarterly' then 20
    else 0
  end;

  insert into public.profiles (id, email, nickname)
  select
    u.id,
    coalesce(v_order.email, u.email),
    coalesce(
      nullif(u.raw_user_meta_data ->> 'nickname', ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      '小宣用户'
    )
  from auth.users u where u.id = v_order.user_id
  on conflict (id) do nothing;

  select member_expires_at into v_current_expiry
  from public.profiles where id = v_order.user_id for update;
  if not found then raise exception 'user_not_found'; end if;

  v_period_start := case
    when v_current_expiry is not null and v_current_expiry >= current_date then v_current_expiry + 1
    else current_date
  end;
  v_new_expiry := (greatest(coalesce(v_current_expiry, current_date), current_date) + v_duration_days)::date;

  update public.profiles
  set member_status = 'member', member_expires_at = v_new_expiry, updated_at = now()
  where id = v_order.user_id;

  update public.membership_orders
  set status = 'paid', wechat_transaction_id = p_transaction_id,
    paid_at = p_paid_at, member_expires_at = v_new_expiry,
    raw_notification = p_raw_notification, updated_at = now()
  where id = v_order.id;

  if v_order.plan_code = 'annual' then
    insert into public.annual_membership_point_periods
      (user_id, source_order_id, source_key, starts_on, ends_on)
    values
      (v_order.user_id, v_order.id, 'order:' || v_order.id::text, v_period_start, v_new_expiry)
    on conflict (source_key) do nothing;
  elsif v_bonus_points > 0 then
    v_inserted_points := null;
    insert into public.point_transactions
      (user_id, amount, event_type, reference_order_id, grant_date, idempotency_key, description)
    values
      (v_order.user_id, v_bonus_points, 'membership_opening_bonus', v_order.id, current_date,
       'membership-order-bonus:' || v_order.id::text,
       case v_order.plan_code when 'monthly' then '月度会员开通赠送' else '季度会员开通赠送' end)
    on conflict (idempotency_key) do nothing
    returning amount into v_inserted_points;

    if v_inserted_points is not null then
      update public.profiles
      set points_balance = points_balance + v_inserted_points, updated_at = now()
      where id = v_order.user_id;
    end if;
  end if;

  return v_new_expiry;
end;
$$;

revoke all on function public.activate_membership_order(text, text, timestamptz, jsonb) from public;
grant execute on function public.activate_membership_order(text, text, timestamptz, jsonb) to service_role;

-- 为每一笔仍可能有效的历史年卡建立周期。只从迁移当天开始赠送，
-- 不追溯旧日期；同一用户同一天仍由积分流水唯一键保证只发一次。
insert into public.annual_membership_point_periods
  (user_id, source_order_id, source_key, starts_on, ends_on)
select
  o.user_id,
  o.id,
  'order:' || o.id::text,
  greatest(current_date, o.member_expires_at - 365),
  o.member_expires_at
from public.membership_orders o
join public.profiles p on p.id = o.user_id
where o.status = 'paid'
  and coalesce(o.plan_code, 'annual') = 'annual'
  and o.member_expires_at >= current_date
  and p.member_status = 'member'
  and p.member_expires_at >= current_date
on conflict (source_key) do nothing;

-- 旧系统可能直接写会员状态而没有订单。这类存量会员按原年费会员来源兼容。
insert into public.annual_membership_point_periods
  (user_id, source_order_id, source_key, starts_on, ends_on)
select
  p.id,
  null,
  'legacy-active-annual:' || p.id::text,
  current_date,
  p.member_expires_at
from public.profiles p
where p.member_status = 'member'
  and p.member_expires_at >= current_date
  and not exists (
    select 1 from public.membership_orders o
    where o.user_id = p.id and o.status = 'paid'
  )
on conflict (source_key) do nothing;

-- 每次运行会补齐截至当天仍未发放的日期；唯一幂等键保证并发安全。
create or replace function public.grant_due_annual_membership_points(
  p_through_date date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_through_date date := least(coalesce(p_through_date, current_date), current_date);
  v_granted_count bigint := 0;
  v_total_points bigint := 0;
  v_updated_users bigint := 0;
begin
  with eligible as (
    select distinct
      period.user_id,
      day_value::date as grant_date
    from public.annual_membership_point_periods period
    join public.profiles profile on profile.id = period.user_id
    cross join lateral generate_series(
      period.starts_on,
      least(period.ends_on, profile.member_expires_at, v_through_date),
      interval '1 day'
    ) day_value
    where period.revoked_at is null
      and period.starts_on <= v_through_date
      and profile.member_status = 'member'
      and profile.member_expires_at >= period.starts_on
  ), inserted as (
    insert into public.point_transactions
      (user_id, amount, event_type, grant_date, idempotency_key, description)
    select
      eligible.user_id,
      10,
      'annual_daily',
      eligible.grant_date,
      'annual-daily:' || eligible.user_id::text || ':' || eligible.grant_date::text,
      '年度会员每日赠送'
    from eligible
    on conflict (idempotency_key) do nothing
    returning user_id, amount
  ), totals as (
    select user_id, sum(amount)::integer as amount
    from inserted
    group by user_id
  ), updated as (
    update public.profiles profile
    set points_balance = profile.points_balance + totals.amount,
      updated_at = now()
    from totals
    where profile.id = totals.user_id
    returning profile.id
  )
  select
    (select count(*) from inserted),
    coalesce((select sum(amount) from inserted), 0),
    (select count(*) from updated)
  into v_granted_count, v_total_points, v_updated_users;

  return jsonb_build_object(
    'throughDate', v_through_date,
    'grantedCount', v_granted_count,
    'totalPoints', v_total_points,
    'updatedUsers', v_updated_users
  );
end;
$$;

revoke all on function public.grant_due_annual_membership_points(date) from public;
grant execute on function public.grant_due_annual_membership_points(date) to service_role;

commit;
