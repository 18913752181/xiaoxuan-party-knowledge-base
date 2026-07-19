create extension if not exists "pgcrypto";

drop table if exists public.favorites;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_slug text not null,
  title text not null,
  category text not null,
  created_at timestamptz not null default now(),
  unique (user_id, article_slug)
);

alter table public.favorites enable row level security;

drop policy if exists "users can read own favorites" on public.favorites;
drop policy if exists "users can insert own favorites" on public.favorites;
drop policy if exists "users can delete own favorites" on public.favorites;

create policy "users can read own favorites"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own favorites"
on public.favorites for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can delete own favorites"
on public.favorites for delete
to authenticated
using (auth.uid() = user_id);
