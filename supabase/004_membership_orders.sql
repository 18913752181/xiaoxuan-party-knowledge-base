begin;

create extension if not exists pgcrypto;

-- 用户的登录身份以 auth.users 为准；profiles 只保存业务扩展字段。
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nickname text,
  phone text,
  member_status text not null default 'free',
  member_expires_at date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists member_status text default 'free';
alter table public.profiles add column if not exists member_expires_at date;
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

update public.profiles set member_status = 'free' where member_status is null;
update public.profiles set is_admin = false where is_admin is null;
update public.profiles set created_at = now() where created_at is null;
update public.profiles set updated_at = now() where updated_at is null;

alter table public.profiles alter column member_status set default 'free';
alter table public.profiles alter column member_status set not null;
alter table public.profiles alter column is_admin set default false;
alter table public.profiles alter column is_admin set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column created_at set not null;
alter table public.profiles alter column updated_at set default now();
alter table public.profiles alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_member_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_member_status_check
      check (member_status in ('free', 'member'));
  end if;
end
$$;

-- 为已经注册的 Supabase 用户补建扩展资料。
insert into public.profiles (id, email, nickname)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'nickname', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    '小宣用户'
  )
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  nickname = coalesce(public.profiles.nickname, excluded.nickname),
  updated_at = now();

-- 新用户注册后自动创建 profiles 扩展记录。
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nickname)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '小宣用户'
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- 订单的外键直接关联真实登录用户 auth.users(id)，不依赖 profiles 是否已生成。
create table if not exists public.membership_orders (
  id uuid primary key default gen_random_uuid(),
  out_trade_no text not null unique,
  user_id uuid not null,
  email text,
  plan_code text not null default 'annual',
  description text not null,
  amount_total integer not null,
  status text not null default 'pending',
  wechat_transaction_id text unique,
  paid_at timestamptz,
  member_expires_at date,
  raw_notification jsonb,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.membership_orders add column if not exists email text;
alter table public.membership_orders add column if not exists plan_code text default 'annual';
alter table public.membership_orders add column if not exists description text;
alter table public.membership_orders add column if not exists amount_total integer;
alter table public.membership_orders add column if not exists status text default 'pending';
alter table public.membership_orders add column if not exists wechat_transaction_id text;
alter table public.membership_orders add column if not exists paid_at timestamptz;
alter table public.membership_orders add column if not exists member_expires_at date;
alter table public.membership_orders add column if not exists raw_notification jsonb;
alter table public.membership_orders add column if not exists expires_at timestamptz default (now() + interval '2 hours');
alter table public.membership_orders add column if not exists created_at timestamptz default now();
alter table public.membership_orders add column if not exists updated_at timestamptz default now();

-- 若旧版本曾建立过指向 profiles 的外键，统一改为 auth.users。
alter table public.membership_orders
  drop constraint if exists membership_orders_user_id_fkey;
alter table public.membership_orders
  add constraint membership_orders_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'membership_orders_amount_total_check'
      and conrelid = 'public.membership_orders'::regclass
  ) then
    alter table public.membership_orders
      add constraint membership_orders_amount_total_check
      check (amount_total > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'membership_orders_status_check'
      and conrelid = 'public.membership_orders'::regclass
  ) then
    alter table public.membership_orders
      add constraint membership_orders_status_check
      check (status in ('pending', 'paid', 'closed', 'failed', 'refunded'));
  end if;
end
$$;

create unique index if not exists membership_orders_out_trade_no_uidx
  on public.membership_orders(out_trade_no);
create unique index if not exists membership_orders_wechat_transaction_id_uidx
  on public.membership_orders(wechat_transaction_id)
  where wechat_transaction_id is not null;
create index if not exists membership_orders_user_id_idx
  on public.membership_orders(user_id, created_at desc);
create index if not exists membership_orders_status_idx
  on public.membership_orders(status, created_at desc);

alter table public.membership_orders enable row level security;

drop policy if exists "Users can read own membership orders"
  on public.membership_orders;
create policy "Users can read own membership orders"
on public.membership_orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read membership orders"
  on public.membership_orders;
create policy "Admins can read membership orders"
on public.membership_orders
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_admin = true
  )
);

-- 微信支付回调确认后调用：订单只激活一次，会员期默认顺延一年。
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
begin
  select *
  into v_order
  from public.membership_orders
  where out_trade_no = p_out_trade_no
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_order.status = 'paid' then
    return v_order.member_expires_at;
  end if;

  -- 防止历史用户缺少扩展资料，付款成功时再次兜底补建。
  insert into public.profiles (id, email, nickname)
  select
    u.id,
    coalesce(v_order.email, u.email),
    coalesce(
      nullif(u.raw_user_meta_data ->> 'nickname', ''),
      nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
      '小宣用户'
    )
  from auth.users u
  where u.id = v_order.user_id
  on conflict (id) do nothing;

  select member_expires_at
  into v_current_expiry
  from public.profiles
  where id = v_order.user_id
  for update;

  if not found then
    raise exception 'user_not_found';
  end if;

  v_new_expiry :=
    (greatest(coalesce(v_current_expiry, current_date), current_date)
      + interval '1 year')::date;

  update public.profiles
  set
    member_status = 'member',
    member_expires_at = v_new_expiry,
    updated_at = now()
  where id = v_order.user_id;

  update public.membership_orders
  set
    status = 'paid',
    wechat_transaction_id = p_transaction_id,
    paid_at = p_paid_at,
    member_expires_at = v_new_expiry,
    raw_notification = p_raw_notification,
    updated_at = now()
  where id = v_order.id;

  return v_new_expiry;
end;
$$;

revoke all
on function public.activate_membership_order(text, text, timestamptz, jsonb)
from public;
grant execute
on function public.activate_membership_order(text, text, timestamptz, jsonb)
to service_role;

commit;
