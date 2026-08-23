-- 009_membership_plans.sql
-- 将原有单一年费会员升级为月卡、季卡、年卡。
-- 历史订单保留原 plan_code=annual；所有当前有效会员自动拥有 Dimmo 权益，
-- 不改变其原有到期日，也不要求补差价。

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
  v_duration_days integer;
begin
  select * into v_order from public.membership_orders
  where out_trade_no = p_out_trade_no for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status = 'paid' then return v_order.member_expires_at; end if;

  v_duration_days := case v_order.plan_code
    when 'monthly' then 30
    when 'quarterly' then 90
    else 365
  end;

  insert into public.profiles (id, email, nickname)
  select u.id, coalesce(v_order.email, u.email), coalesce(nullif(u.raw_user_meta_data ->> 'nickname', ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), '小宣用户')
  from auth.users u where u.id = v_order.user_id
  on conflict (id) do nothing;

  select member_expires_at into v_current_expiry
  from public.profiles where id = v_order.user_id for update;
  if not found then raise exception 'user_not_found'; end if;

  v_new_expiry := (greatest(coalesce(v_current_expiry, current_date), current_date) + v_duration_days)::date;

  update public.profiles set member_status = 'member', member_expires_at = v_new_expiry, updated_at = now()
  where id = v_order.user_id;
  update public.membership_orders set status = 'paid', wechat_transaction_id = p_transaction_id,
    paid_at = p_paid_at, member_expires_at = v_new_expiry, raw_notification = p_raw_notification,
    updated_at = now() where id = v_order.id;
  return v_new_expiry;
end;
$$;

revoke all on function public.activate_membership_order(text, text, timestamptz, jsonb) from public;
grant execute on function public.activate_membership_order(text, text, timestamptz, jsonb) to service_role;
