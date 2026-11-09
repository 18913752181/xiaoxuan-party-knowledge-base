begin;

-- Profile owners can edit their basic details, never their own entitlement.
create or replace function public.protect_membership_entitlement()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.member_status <> 'free' or new.member_expires_at is not null or new.is_admin then
        raise exception 'membership_entitlement_is_server_managed';
      end if;
    elsif new.member_status is distinct from old.member_status
       or new.member_expires_at is distinct from old.member_expires_at
       or new.is_admin is distinct from old.is_admin then
      raise exception 'membership_entitlement_is_server_managed';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profiles_membership_entitlement on public.profiles;
create trigger protect_profiles_membership_entitlement before insert or update on public.profiles
for each row execute function public.protect_membership_entitlement();

-- Download rights come from a current, paid annual term or a grandfathered
-- membership. Profile expiry alone does not make a month/quarter card annual.
create or replace function public.material_download_entitlement(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with dates as (
    select (now() at time zone 'Asia/Shanghai')::date as today
  ), profile as (
    select p.*,
      p.member_status = 'member' and coalesce(
        p.member_expires_at >= case when p.material_download_policy = 'annual_daily' then d.today else current_date end,
        false
      ) as active
    from public.profiles p cross join dates d where p.id = p_user_id
  ), annual as (
    select max(a.ends_on) as expires_at
    from public.annual_material_memberships a
    join public.membership_orders o on o.id = a.source_order_id and o.user_id = a.user_id
    cross join dates d
    where a.user_id = p_user_id and o.status = 'paid' and coalesce(o.plan_code, 'annual') = 'annual'
      and a.starts_on <= d.today and a.ends_on >= d.today
  ), latest as (
    select o.plan_code from public.membership_orders o
    where o.user_id = p_user_id and o.status = 'paid'
    order by o.paid_at desc nulls last, o.id desc limit 1
  )
  select coalesce((
    select jsonb_build_object(
      'memberActive', p.active,
      'canDownload', p.active and (a.expires_at is not null or p.material_download_policy in ('legacy_free', 'legacy_points')),
      'planCode', case when p.active and a.expires_at is not null then 'annual' else l.plan_code end,
      'downloadExpiresAt', case
        when not p.active then null
        when p.material_download_policy in ('legacy_free', 'legacy_points') then p.member_expires_at
        when a.expires_at is not null then least(a.expires_at, p.member_expires_at) end
    )
    from profile p cross join annual a left join latest l on true
  ), '{"memberActive":false,"canDownload":false,"planCode":null,"downloadExpiresAt":null}'::jsonb);
$$;
revoke all on function public.material_download_entitlement(uuid) from public, anon, authenticated;
grant execute on function public.material_download_entitlement(uuid) to service_role;

-- Payment and activation stay atomic and idempotent, including orders that
-- were already created under the old storefront. Only annual orders add a
-- download term; no order writes to the old points ledger anymore.
create or replace function public.activate_membership_order(
  p_out_trade_no text, p_transaction_id text, p_paid_at timestamptz, p_raw_notification jsonb
) returns date language plpgsql security definer set search_path = public as $$
declare
  v_order public.membership_orders%rowtype;
  v_current_expiry date;
  v_expiry date;
  v_days integer;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into v_order from public.membership_orders where out_trade_no = p_out_trade_no for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'paid' then return v_order.member_expires_at; end if;
  if v_order.status = 'refunded' then raise exception 'order_already_refunded'; end if;

  v_days := case coalesce(v_order.plan_code, 'annual')
    when 'monthly' then 30 when 'quarterly' then 90 when 'annual' then 365 end;
  if v_days is null then raise exception 'invalid_membership_plan'; end if;

  insert into public.profiles (id, email, nickname)
  select u.id, coalesce(v_order.email, u.email),
    coalesce(nullif(u.raw_user_meta_data ->> 'nickname', ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''), '小宣用户')
  from auth.users u where u.id = v_order.user_id
  on conflict (id) do nothing;

  select member_expires_at into v_current_expiry from public.profiles where id = v_order.user_id for update;
  if not found then raise exception 'user_not_found'; end if;
  v_expiry := greatest(v_current_expiry, v_today) + v_days;
  update public.profiles set member_status = 'member', member_expires_at = v_expiry, updated_at = now()
  where id = v_order.user_id;

  update public.membership_orders set status = 'paid', wechat_transaction_id = p_transaction_id,
    paid_at = p_paid_at, member_expires_at = v_expiry, raw_notification = p_raw_notification, updated_at = now()
  where id = v_order.id;

  if coalesce(v_order.plan_code, 'annual') = 'annual' then
    insert into public.annual_material_memberships(source_order_id, user_id, starts_on, ends_on)
    values (v_order.id, v_order.user_id, v_today, v_expiry) on conflict do nothing;
  end if;
  return v_expiry;
end;
$$;
revoke all on function public.activate_membership_order(text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.activate_membership_order(text,text,timestamptz,jsonb) to service_role;

-- A full refund and the resulting profile state must commit together. A
-- refunded annual order never grants downloads, even when another plan is active.
create or replace function public.refund_membership_order(
  p_out_trade_no text, p_amount_total integer, p_raw_notification jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.membership_orders%rowtype;
  v_expiry date;
  v_today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  select * into v_order from public.membership_orders where out_trade_no = p_out_trade_no for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'refunded' then return; end if;
  if v_order.status <> 'paid' then raise exception 'order_not_paid'; end if;
  if v_order.amount_total is distinct from p_amount_total then raise exception 'refund_amount_mismatch'; end if;

  perform 1 from public.profiles where id = v_order.user_id for update;
  update public.membership_orders set status = 'refunded', raw_notification = p_raw_notification, updated_at = now()
  where id = v_order.id;

  select max(member_expires_at) into v_expiry from public.membership_orders
  where user_id = v_order.user_id and status = 'paid';
  update public.profiles set
    member_status = case when v_expiry >= v_today then 'member' else 'free' end,
    member_expires_at = case when v_expiry >= v_today then v_expiry else null end,
    updated_at = now()
  where id = v_order.user_id;
end;
$$;
revoke all on function public.refund_membership_order(text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.refund_membership_order(text,integer,jsonb) to service_role;

-- Keep historical data intact. Compatibility functions let the previous app
-- version and any already scheduled grant job survive a rolling deployment
-- without creating new points, unlocks, or quota entries.
create or replace function public.grant_due_annual_membership_points(p_through_date date default current_date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('throughDate', coalesce(p_through_date, current_date),
    'grantedCount', 0, 'totalPoints', 0, 'updatedUsers', 0);
$$;

create or replace function public.material_download_state(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select s || jsonb_build_object(
    'paid', s->'memberActive', 'legacyBenefits', s->'canDownload',
    'annualExpiresAt', s->'downloadExpiresAt', 'pointsBalance', coalesce(p.points_balance, 0),
    'permanentPoints', coalesce(p.points_balance, 0), 'dailyPoints', 0, 'dailyLimit', null,
    'dailyUsed', 0, 'dailyRemaining', 0, 'todayDownloadedSlugs', '[]'::jsonb, 'unlockedSlugs', '[]'::jsonb)
  from public.material_download_entitlement(p_user_id) s
  left join public.profiles p on p.id = p_user_id;
$$;

create or replace function public.claim_material_downloads(p_user_id uuid, p_materials jsonb, p_expected_points integer default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('ok', s->'canDownload',
    'code', case when (s->>'canDownload')::boolean then null else 'ANNUAL_MEMBERSHIP_REQUIRED' end,
    'chargedPoints', 0, 'pointsBalance', s->'pointsBalance')
  from public.material_download_state(p_user_id) s;
$$;

commit;
