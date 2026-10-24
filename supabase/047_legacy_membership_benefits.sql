begin;

-- 同一事务内固定规则切换时的存量会员身份，重复迁移不会扩大名单。
lock table public.membership_orders in share row exclusive mode;
lock table public.profiles in share row exclusive mode;
alter table public.profiles add column if not exists legacy_material_benefits boolean not null default false;
create table if not exists public.membership_rule_cutovers (
  rule_key text primary key,
  applied_at timestamptz not null default now()
);
alter table public.membership_rule_cutovers enable row level security;
revoke all on public.membership_rule_cutovers from public, anon, authenticated;

with first_cutover as (
  insert into public.membership_rule_cutovers(rule_key)
  values ('material-points-v1')
  on conflict (rule_key) do nothing
  returning rule_key
)
update public.profiles
set legacy_material_benefits = true
where member_status = 'member'
  and member_expires_at >= current_date
  and exists (select 1 from first_cutover);

create or replace function public.protect_legacy_material_benefits()
returns trigger language plpgsql set search_path = public as $$
begin
  if (TG_OP = 'INSERT' and new.legacy_material_benefits)
    or (TG_OP = 'UPDATE' and new.legacy_material_benefits is distinct from old.legacy_material_benefits) then
    if current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'legacy_material_benefits_is_server_managed';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profiles_legacy_material_benefits on public.profiles;
create trigger protect_profiles_legacy_material_benefits
before insert or update on public.profiles
for each row execute function public.protect_legacy_material_benefits();

-- 停止旧会员补建的积分周期，保留现有积分、历史流水和订单。
update public.annual_membership_point_periods period
set revoked_at = coalesce(period.revoked_at, now())
from public.profiles profile
where profile.id = period.user_id and profile.legacy_material_benefits;

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

  -- 旧会员续费沿用原权益，不进入积分发放周期。
  if exists (select 1 from public.profiles where id = v_order.user_id and legacy_material_benefits) then
    return v_new_expiry;
  end if;

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

do $$
begin
  if to_regprocedure('public.unlock_materials_with_points_v1(uuid,jsonb)') is null then
    alter function public.unlock_materials_with_points(uuid,jsonb)
      rename to unlock_materials_with_points_v1;
  end if;
end;
$$;
revoke all on function public.unlock_materials_with_points_v1(uuid,jsonb) from public, anon, authenticated, service_role;

-- 判断在数据库锁内进行，单份和批量下载共用，不接受浏览器传来的会员身份。
create or replace function public.unlock_materials_with_points(p_user_id uuid, p_materials jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  if v_profile.legacy_material_benefits
    and v_profile.member_status = 'member'
    and v_profile.member_expires_at >= current_date then
    return jsonb_build_object('ok', true, 'chargedPoints', 0,
      'pointsBalance', v_profile.points_balance, 'unlockedSlugs', '[]'::jsonb,
      'legacyBenefits', true);
  end if;
  return public.unlock_materials_with_points_v1(p_user_id, p_materials);
end;
$$;
revoke all on function public.unlock_materials_with_points(uuid,jsonb) from public;
grant execute on function public.unlock_materials_with_points(uuid,jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
