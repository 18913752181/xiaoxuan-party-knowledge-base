-- 006_stats_and_donations.sql
-- 数据统计与自愿赞赏所需的表。全部幂等，可重复执行。
-- 若已执行过 005_downloads.sql，本文件的 downloads 部分会自动跳过。

create extension if not exists "pgcrypto";

-- 判断当前用户是否管理员（security definer，避免 RLS 策略自引用递归）
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 1) 下载记录 --------------------------------------------------------
create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_slug text not null,
  title text not null,
  category text not null default '',
  file_type text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, article_slug)
);

create index if not exists downloads_created_idx on public.downloads (created_at desc);

alter table public.downloads enable row level security;

drop policy if exists "users can read own downloads" on public.downloads;
drop policy if exists "users can insert own downloads" on public.downloads;
drop policy if exists "users can delete own downloads" on public.downloads;
drop policy if exists "users and admins can read downloads" on public.downloads;

create policy "users and admins can read downloads"
on public.downloads for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "users can insert own downloads"
on public.downloads for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can delete own downloads"
on public.downloads for delete
to authenticated
using (auth.uid() = user_id);

-- 2) 收藏表：补充管理员可读（用于统计页） ------------------------------
drop policy if exists "admins can read all favorites" on public.favorites;

create policy "admins can read all favorites"
on public.favorites for select
to authenticated
using (public.is_admin());

-- 3) profiles：补充管理员可读（用于统计页显示用户邮箱） ------------------
drop policy if exists "admins can read all profiles" on public.profiles;

create policy "admins can read all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

-- 4) 登录记录 --------------------------------------------------------
create table if not exists public.logins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists logins_created_idx on public.logins (created_at desc);

alter table public.logins enable row level security;

drop policy if exists "users and admins can read logins" on public.logins;
drop policy if exists "users can insert own logins" on public.logins;

create policy "users and admins can read logins"
on public.logins for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "users can insert own logins"
on public.logins for insert
to authenticated
with check (auth.uid() = user_id);

-- 5) 赞赏记录 --------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  source_slug text not null default '',
  source_title text not null default '',
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  provider text not null default '',
  out_trade_no text unique,
  created_at timestamptz not null default now()
);

create index if not exists donations_created_idx on public.donations (created_at desc);

alter table public.donations enable row level security;

drop policy if exists "users and admins can read donations" on public.donations;
drop policy if exists "users can insert own donations" on public.donations;

create policy "users and admins can read donations"
on public.donations for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

create policy "users can insert own donations"
on public.donations for insert
to authenticated
with check (auth.uid() = user_id);
