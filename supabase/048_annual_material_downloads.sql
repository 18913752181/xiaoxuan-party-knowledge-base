begin;

lock table public.membership_orders in share row exclusive mode;
lock table public.profiles in share row exclusive mode;
alter table public.profiles add column if not exists material_download_policy text not null default 'annual_daily'
  check (material_download_policy in ('legacy_free', 'legacy_points', 'annual_daily'));

-- Freeze existing customers once. Re-running this migration cannot grandfather new buyers.
with cutover as (
  insert into public.membership_rule_cutovers(rule_key) values ('annual-material-downloads-v2')
  on conflict do nothing returning rule_key
)
update public.profiles p set material_download_policy = case when p.legacy_material_benefits then 'legacy_free' else 'legacy_points' end
where exists (select 1 from cutover) and (
  p.legacy_material_benefits or (p.member_status = 'member' and p.member_expires_at >= current_date)
  or exists (select 1 from public.membership_orders o where o.user_id = p.id and o.status = 'paid')
);

create table if not exists public.annual_material_memberships (
  source_order_id uuid primary key references public.membership_orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on)
);
create index if not exists annual_material_memberships_user_idx on public.annual_material_memberships(user_id, ends_on);
create table if not exists public.material_daily_point_wallets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  grant_date date not null,
  remaining integer not null default 5 check (remaining between 0 and 5),
  primary key (user_id, grant_date)
);
create table if not exists public.material_daily_downloads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  download_date date not null,
  material_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, download_date, material_slug)
);
alter table public.annual_material_memberships enable row level security;
alter table public.material_daily_point_wallets enable row level security;
alter table public.material_daily_downloads enable row level security;
revoke all on public.annual_material_memberships, public.material_daily_point_wallets, public.material_daily_downloads from public, anon, authenticated;

create or replace function public.protect_material_download_policy()
returns trigger language plpgsql set search_path = public as $$
begin
  if ((TG_OP = 'INSERT' and new.material_download_policy <> 'annual_daily')
    or (TG_OP = 'UPDATE' and new.material_download_policy is distinct from old.material_download_policy))
    and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'material_download_policy_is_server_managed';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profiles_material_download_policy on public.profiles;
create trigger protect_profiles_material_download_policy before insert or update on public.profiles
for each row execute function public.protect_material_download_policy();

-- Internal helper. Caller holds the profile lock. Expired daily wallets remain as
-- audit history but never contribute to today's available balance.
create or replace function public.ensure_material_daily_points(p_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_remaining integer := 0;
begin
  if not exists (
    select 1 from public.profiles p join public.annual_material_memberships a on a.user_id = p.id
    join public.membership_orders o on o.id = a.source_order_id
    where p.id = p_user_id and p.material_download_policy = 'annual_daily'
      and p.member_status = 'member' and p.member_expires_at >= v_today
      and a.starts_on <= v_today and a.ends_on >= v_today and o.status = 'paid'
  ) then return 0; end if;
  insert into public.material_daily_point_wallets(user_id, grant_date) values (p_user_id, v_today) on conflict do nothing;
  insert into public.point_transactions(user_id, amount, event_type, grant_date, idempotency_key, description)
  values (p_user_id, 5, 'annual_daily', v_today, 'annual-daily-v2:' || p_user_id::text || ':' || v_today::text,
    '年卡每日赠送5积分（北京时间当天有效）') on conflict (idempotency_key) do nothing;
  select remaining into v_remaining from public.material_daily_point_wallets where user_id = p_user_id and grant_date = v_today;
  return coalesce(v_remaining, 0);
end;
$$;
revoke all on function public.ensure_material_daily_points(uuid) from public, anon, authenticated, service_role;

-- Preserve original opening rewards and old-customer renewal behavior.
do $$ begin
  if to_regprocedure('public.activate_membership_order_before_material_v2(text,text,timestamptz,jsonb)') is null then
    alter function public.activate_membership_order(text,text,timestamptz,jsonb) rename to activate_membership_order_before_material_v2;
  end if;
end $$;
revoke all on function public.activate_membership_order_before_material_v2(text,text,timestamptz,jsonb) from public, anon, authenticated, service_role;

create or replace function public.activate_membership_order(p_out_trade_no text, p_transaction_id text, p_paid_at timestamptz, p_raw_notification jsonb)
returns date language plpgsql security definer set search_path = public as $$
declare
  v_order public.membership_orders%rowtype;
  v_expiry date;
  v_policy text;
  v_bonus integer;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into v_order from public.membership_orders where out_trade_no = p_out_trade_no for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'paid' then return v_order.member_expires_at; end if;
  if v_order.status = 'refunded' then raise exception 'order_already_refunded'; end if;
  v_expiry := public.activate_membership_order_before_material_v2(p_out_trade_no, p_transaction_id, p_paid_at, p_raw_notification);
  select material_download_policy into v_policy from public.profiles where id = v_order.user_id for update;
  if v_policy = 'annual_daily' and v_order.plan_code = 'annual' then
    -- New annual orders use the new wallet, never the old 10/day permanent grant.
    update public.annual_membership_point_periods set revoked_at = coalesce(revoked_at, now()) where source_order_id = v_order.id;
    insert into public.annual_material_memberships(source_order_id, user_id, starts_on, ends_on)
    values (v_order.id, v_order.user_id, v_today, v_expiry) on conflict do nothing;
    insert into public.point_transactions(user_id, amount, event_type, reference_order_id, grant_date, idempotency_key, description)
    values (v_order.user_id, 10, 'membership_opening_bonus', v_order.id, v_today,
      'annual-opening-v2:' || v_order.id::text, '年卡开通赠送10积分（长期有效）')
    on conflict (idempotency_key) do nothing returning amount into v_bonus;
    if v_bonus is not null then update public.profiles set points_balance = points_balance + v_bonus where id = v_order.user_id; end if;
    perform public.ensure_material_daily_points(v_order.user_id);
  end if;
  return v_expiry;
end;
$$;
revoke all on function public.activate_membership_order(text,text,timestamptz,jsonb) from public;
grant execute on function public.activate_membership_order(text,text,timestamptz,jsonb) to service_role;

do $$ begin
  if to_regprocedure('public.grant_due_annual_membership_points_before_material_v2(date)') is null then
    alter function public.grant_due_annual_membership_points(date) rename to grant_due_annual_membership_points_before_material_v2;
  end if;
end $$;
revoke all on function public.grant_due_annual_membership_points_before_material_v2(date) from public, anon, authenticated, service_role;
create or replace function public.grant_due_annual_membership_points(p_through_date date default current_date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_user record; v_count integer := 0;
begin
  v_result := public.grant_due_annual_membership_points_before_material_v2(p_through_date);
  for v_user in select p.id from public.profiles p where p.material_download_policy = 'annual_daily'
    and p.member_status = 'member' order by p.id for update
  loop
    perform public.ensure_material_daily_points(v_user.id);
    v_count := v_count + 1;
  end loop;
  return v_result || jsonb_build_object('dailyWalletUsersChecked', v_count);
end;
$$;
revoke all on function public.grant_due_annual_membership_points(date) from public;
grant execute on function public.grant_due_annual_membership_points(date) to service_role;

create or replace function public.material_download_state(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_annual_end date;
  v_plan text;
  v_daily integer := 0;
  v_used integer := 0;
  v_today_slugs jsonb;
  v_paid boolean;
begin
  select * into p from public.profiles where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  v_paid := p.member_status = 'member' and coalesce(p.member_expires_at >= case when p.material_download_policy = 'annual_daily' then v_today else current_date end, false);
  select max(a.ends_on) into v_annual_end from public.annual_material_memberships a
    join public.membership_orders o on o.id = a.source_order_id
    where a.user_id = p_user_id and a.starts_on <= v_today and a.ends_on >= v_today and o.status = 'paid';
  select plan_code into v_plan from public.membership_orders where user_id = p_user_id and status = 'paid' order by paid_at desc nulls last, id desc limit 1;
  if p.material_download_policy = 'annual_daily' then
    v_daily := public.ensure_material_daily_points(p_user_id);
    select count(*)::integer, coalesce(jsonb_agg(material_slug), '[]'::jsonb) into v_used, v_today_slugs
      from public.material_daily_downloads where user_id = p_user_id and download_date = v_today;
  end if;
  return jsonb_build_object('paid', v_paid,
    'legacyBenefits', v_paid and p.legacy_material_benefits,
    'policy', p.material_download_policy,
    'canDownload', case when p.material_download_policy = 'annual_daily' then v_paid and v_annual_end is not null else v_paid end,
    'annualExpiresAt', v_annual_end, 'planCode', v_plan,
    'pointsBalance', p.points_balance + v_daily, 'permanentPoints', p.points_balance, 'dailyPoints', v_daily,
    'dailyLimit', case when p.material_download_policy = 'annual_daily' then 10 else null end,
    'dailyUsed', v_used, 'dailyRemaining', greatest(0, 10 - v_used), 'day', v_today,
    'todayDownloadedSlugs', coalesce(v_today_slugs, '[]'::jsonb),
    'unlockedSlugs', coalesce((select jsonb_agg(material_slug) from public.material_point_unlocks where user_id = p_user_id), '[]'::jsonb));
end;
$$;
revoke all on function public.material_download_state(uuid) from public;
grant execute on function public.material_download_state(uuid) to service_role;

create or replace function public.claim_material_downloads(p_user_id uuid, p_materials jsonb, p_expected_points integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  v_state jsonb;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
  v_required integer := 0;
  v_new_count integer := 0;
  v_daily integer := 0;
  v_daily_spent integer := 0;
  v_transaction uuid;
  v_item record;
  v_result jsonb;
begin
  if p_user_id is null or jsonb_typeof(p_materials) <> 'array' or jsonb_array_length(p_materials) not between 1 and 50 then
    raise exception 'invalid_download_request';
  end if;
  if exists (select 1 from jsonb_array_elements(p_materials) i where nullif(btrim(i->>'slug'), '') is null
    or coalesce(i->>'cost', '') !~ '^[0-9]+$' or (i->>'cost')::numeric > 9999) then
    raise exception 'invalid_download_request';
  end if;
  select * into p from public.profiles where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  -- This lock serializes points, daily quotas and concurrent single/batch downloads.
  v_state := public.material_download_state(p_user_id);
  select coalesce(sum(r.cost), 0)::integer into v_required from (
    select item->>'slug' slug, max((item->>'cost')::integer) cost from jsonb_array_elements(p_materials) item
    group by item->>'slug'
  ) r where not exists (select 1 from public.material_point_unlocks u where u.user_id = p_user_id and u.material_slug = r.slug);
  if (v_state->>'legacyBenefits')::boolean then v_required := 0; end if;
  if p_expected_points is not null and v_required > p_expected_points then
    return v_state || jsonb_build_object('ok', false, 'code', 'POINTS_QUOTE_CHANGED', 'requiredPoints', v_required, 'chargedPoints', 0);
  end if;
  if p.material_download_policy <> 'annual_daily' then
    return public.unlock_materials_with_points_v1_or_legacy(p_user_id, p_materials);
  end if;
  if not (v_state->>'canDownload')::boolean then
    return v_state || jsonb_build_object('ok', false, 'code', 'ANNUAL_MEMBERSHIP_REQUIRED', 'chargedPoints', 0);
  end if;
  select count(*)::integer into v_new_count from (select distinct item->>'slug' slug from jsonb_array_elements(p_materials) item) r
    where not exists (select 1 from public.material_daily_downloads d where d.user_id = p_user_id and d.download_date = v_today and d.material_slug = r.slug);
  if v_new_count > (v_state->>'dailyRemaining')::integer then
    return v_state || jsonb_build_object('ok', false, 'code', 'DAILY_DOWNLOAD_LIMIT', 'requestedNew', v_new_count, 'chargedPoints', 0);
  end if;
  if v_required > (v_state->>'pointsBalance')::integer then
    return v_state || jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_POINTS', 'requiredPoints', v_required, 'chargedPoints', 0);
  end if;
  v_daily := (v_state->>'dailyPoints')::integer;
  v_daily_spent := least(v_daily, v_required);
  for v_item in select item->>'slug' slug, max((item->>'cost')::integer) cost from jsonb_array_elements(p_materials) item group by item->>'slug'
  loop
    if not exists (select 1 from public.material_point_unlocks u where u.user_id = p_user_id and u.material_slug = v_item.slug) then
      v_transaction := null;
      if v_item.cost > 0 then
        insert into public.point_transactions(user_id, amount, event_type, idempotency_key, description)
        values (p_user_id, -v_item.cost, 'material_unlock', 'material-unlock:' || p_user_id::text || ':' || v_item.slug,
          '资料首次下载解锁：' || v_item.slug) returning id into v_transaction;
      end if;
      insert into public.material_point_unlocks(user_id, material_slug, points_spent, point_transaction_id)
      values (p_user_id, v_item.slug, v_item.cost, v_transaction);
    end if;
    insert into public.material_daily_downloads(user_id, download_date, material_slug) values (p_user_id, v_today, v_item.slug) on conflict do nothing;
  end loop;
  update public.material_daily_point_wallets set remaining = remaining - v_daily_spent where user_id = p_user_id and grant_date = v_today;
  update public.profiles set points_balance = points_balance - (v_required - v_daily_spent), updated_at = now() where id = p_user_id;
  v_result := public.material_download_state(p_user_id);
  return v_result || jsonb_build_object('ok', true, 'chargedPoints', v_required);
end;
$$;

-- Keep the old two-argument API safe while older app containers are replaced.
do $$ begin
  if to_regprocedure('public.unlock_materials_with_points_v1_or_legacy(uuid,jsonb)') is null then
    alter function public.unlock_materials_with_points(uuid,jsonb) rename to unlock_materials_with_points_v1_or_legacy;
  end if;
end $$;
revoke all on function public.unlock_materials_with_points_v1_or_legacy(uuid,jsonb) from public, anon, authenticated, service_role;
create or replace function public.unlock_materials_with_points(p_user_id uuid, p_materials jsonb)
returns jsonb language sql security definer set search_path = public as $$
  select public.claim_material_downloads(p_user_id, p_materials, null);
$$;
revoke all on function public.claim_material_downloads(uuid,jsonb,integer), public.unlock_materials_with_points(uuid,jsonb) from public;
grant execute on function public.claim_material_downloads(uuid,jsonb,integer), public.unlock_materials_with_points(uuid,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
