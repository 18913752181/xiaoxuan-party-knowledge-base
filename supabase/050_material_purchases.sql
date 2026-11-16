
begin;

create table if not exists public.material_purchase_orders (
  out_trade_no text primary key check (out_trade_no ~ '^XM[0-9A-Z]{20,30}$'),
  user_id uuid not null references auth.users(id) on delete restrict,
  first_slug text not null,
  second_slug text,
  amount_total integer not null check (amount_total in (390,490)),
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed','closed')),
  transaction_id text unique,
  pay_data jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (second_slug is null or (amount_total = 490 and first_slug <> second_slug))
);
create index if not exists material_purchase_user_idx on public.material_purchase_orders(user_id, status, created_at);
create unique index if not exists material_purchase_pending_idx on public.material_purchase_orders(user_id, first_slug) where status = 'pending';
alter table public.material_purchase_orders enable row level security;
revoke all on public.material_purchase_orders from public, anon, authenticated;
grant select, insert, update on public.material_purchase_orders to service_role;

create or replace function public.material_purchase_access(p_user_id uuid, p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'owned', coalesce(bool_or(first_slug = p_slug or second_slug = p_slug), false),
    'remaining', count(*) filter (where amount_total = 490 and second_slug is null)
  )
  from public.material_purchase_orders where user_id = p_user_id and status = 'paid';
$$;

create or replace function public.redeem_material_purchase(p_user_id uuid, p_slug text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_order text;
begin
  perform pg_advisory_xact_lock(hashtextextended('material-purchase:' || p_user_id::text, 0));
  if (public.material_purchase_access(p_user_id, p_slug)->>'owned')::boolean then return true; end if;
  select out_trade_no into v_order from public.material_purchase_orders
    where user_id = p_user_id and status = 'paid' and amount_total = 490 and second_slug is null
      and first_slug <> p_slug
    order by paid_at, out_trade_no limit 1 for update;
  if not found then return false; end if;
  update public.material_purchase_orders set second_slug = p_slug where out_trade_no = v_order;
  return true;
end;
$$;

create or replace function public.set_material_purchase_status(
  p_order text, p_amount integer, p_transaction_id text, p_paid_at timestamptz, p_refund boolean
) returns boolean language plpgsql security definer set search_path = public as $$
declare o public.material_purchase_orders%rowtype;
begin
  select * into o from public.material_purchase_orders where out_trade_no = p_order for update;
  if not found or o.amount_total is distinct from p_amount then return false; end if;
  if p_refund then
    if o.status = 'refunded' then return true; end if;
    if o.status <> 'paid' then return false; end if;
    update public.material_purchase_orders set status = 'refunded' where out_trade_no = p_order;
  else
    if p_transaction_id is null or p_transaction_id = '' or p_paid_at is null then return false; end if;
    if o.status in ('paid','refunded') then return o.transaction_id = p_transaction_id; end if;
    update public.material_purchase_orders set status = 'paid', transaction_id = p_transaction_id, paid_at = p_paid_at where out_trade_no = p_order;
  end if;
  return true;
end;
$$;

revoke all on function public.material_purchase_access(uuid,text), public.redeem_material_purchase(uuid,text),
  public.set_material_purchase_status(text,integer,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.material_purchase_access(uuid,text), public.redeem_material_purchase(uuid,text),
  public.set_material_purchase_status(text,integer,text,timestamptz,boolean) to service_role;

commit;
