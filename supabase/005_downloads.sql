create extension if not exists "pgcrypto";

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

create index if not exists downloads_user_created_idx
on public.downloads (user_id, created_at desc);

alter table public.downloads enable row level security;

drop policy if exists "users can read own downloads" on public.downloads;
drop policy if exists "users can insert own downloads" on public.downloads;
drop policy if exists "users can delete own downloads" on public.downloads;

create policy "users can read own downloads"
on public.downloads for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own downloads"
on public.downloads for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can delete own downloads"
on public.downloads for delete
to authenticated
using (auth.uid() = user_id);
