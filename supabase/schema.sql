create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '小宣读者',
  email text,
  phone text,
  member_status text not null default 'free' check (member_status in ('free', 'member')),
  member_expires_at date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null,
  file_type text not null,
  file_size text not null default '',
  updated_at date not null default current_date,
  member_only boolean not null default false,
  download_count integer not null default 0,
  favorite_count integer not null default 0,
  file_url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, material_id)
);

create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nickname', '小宣读者'),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.increment_material_downloads(material_id_input uuid)
returns void
language sql
as $$
  update public.materials
  set download_count = download_count + 1
  where id = material_id_input;
$$;

create or replace function public.increment_material_favorites(material_id_input uuid)
returns void
language sql
as $$
  update public.materials
  set favorite_count = favorite_count + 1
  where id = material_id_input;
$$;

create or replace function public.decrement_material_favorites(material_id_input uuid)
returns void
language sql
as $$
  update public.materials
  set favorite_count = greatest(favorite_count - 1, 0)
  where id = material_id_input;
$$;

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.favorites enable row level security;
alter table public.downloads enable row level security;

create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "profiles can update own basic profile"
on public.profiles for update
to authenticated
using (auth.uid() = id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "materials are readable by everyone"
on public.materials for select
to anon, authenticated
using (true);

create policy "admins can manage materials"
on public.materials for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "users can manage own favorites"
on public.favorites for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can read own downloads"
on public.downloads for select
to authenticated
using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "users can create own downloads"
on public.downloads for insert
to authenticated
with check (auth.uid() = user_id);

insert into public.materials
  (title, description, category, file_type, file_size, updated_at, member_only, download_count, favorite_count, file_url)
values
  ('思想汇报怎么写', '适合发展党员材料准备的写作说明，包含结构、语气和常见注意事项。', '发展党员', 'Word', '42 KB', current_date, false, 128, 36, 'https://example.com/sixianghuibao.docx'),
  ('换届主持词', '基层党组织换届会议主持词模板，可按会议流程直接编辑。', '换届选举', 'Word', '58 KB', current_date, true, 89, 24, 'https://example.com/huanjiezhuchici.docx')
on conflict do nothing;
