-- 008_work_cat.sql
-- Dimmo「工作小猫」微信公众号消息、待回复问题与留言。
-- 在 Supabase SQL Editor 中整段执行；服务号 webhook 使用 service role 写入，
-- 后台管理员通过服务端接口读取，不向普通前台用户开放。

create extension if not exists "pgcrypto";

create table if not exists public.wechat_users (
  id uuid primary key default gen_random_uuid(),
  openid text not null unique,
  nickname text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.wechat_conversations (
  id uuid primary key default gen_random_uuid(),
  openid text not null,
  role text not null check (role in ('user', 'cat', 'xiaoxuan')),
  content text not null,
  wechat_msg_id text,
  category text,
  created_at timestamptz not null default now()
);

create unique index if not exists wechat_conversations_msg_id_key
  on public.wechat_conversations (wechat_msg_id)
  where wechat_msg_id is not null;
create index if not exists wechat_conversations_openid_created_idx
  on public.wechat_conversations (openid, created_at desc);

create table if not exists public.pending_questions (
  id uuid primary key default gen_random_uuid(),
  openid text not null,
  question text not null,
  context_summary text not null default '',
  category text not null,
  status text not null default 'pending' check (status in ('pending', 'replied', 'closed')),
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create index if not exists pending_questions_status_created_idx
  on public.pending_questions (status, created_at desc);

create table if not exists public.wechat_reminders (
  id uuid primary key default gen_random_uuid(),
  openid text not null,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists wechat_reminders_status_created_idx
  on public.wechat_reminders (status, created_at desc);

alter table public.wechat_users enable row level security;
alter table public.wechat_conversations enable row level security;
alter table public.pending_questions enable row level security;
alter table public.wechat_reminders enable row level security;

-- 管理员只读/处理。Webhook 本身走 service role，会绕过 RLS。
create policy "admins can read wechat users"
on public.wechat_users for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can read wechat conversations"
on public.wechat_conversations for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can read pending questions"
on public.pending_questions for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update pending questions"
on public.pending_questions for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can read wechat reminders"
on public.wechat_reminders for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can update wechat reminders"
on public.wechat_reminders for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

comment on table public.wechat_users is '工作小猫接待过的微信公众号用户';
comment on table public.wechat_conversations is '工作小猫与用户的文字消息记录';
comment on table public.pending_questions is '等待小宣社长处理的专业问题';
comment on table public.wechat_reminders is '用户委托工作小猫记录的提醒/留言';
