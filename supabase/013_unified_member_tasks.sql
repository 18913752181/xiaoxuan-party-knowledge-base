-- Dimmo 与小程序「喵喵看板」共用同一套任务数据。
-- 继续复用 wechat_reminders，避免迁移或复制已有提醒。

alter table public.wechat_reminders
  add column if not exists source text not null default 'dimmo',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.wechat_reminders
  drop constraint if exists wechat_reminders_source_check;

alter table public.wechat_reminders
  add constraint wechat_reminders_source_check
  check (source in ('dimmo', 'miniprogram'));

create index if not exists wechat_reminders_openid_updated_idx
  on public.wechat_reminders (openid, updated_at desc);

create or replace function public.touch_wechat_reminder_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_wechat_reminder_updated_at on public.wechat_reminders;
create trigger touch_wechat_reminder_updated_at
before update on public.wechat_reminders
for each row execute function public.touch_wechat_reminder_updated_at();

-- 服务号 openid 与小程序 openid 属于不同身份空间，只能通过服务端绑定。
create table if not exists public.wechat_task_identity_bindings (
  id uuid primary key default gen_random_uuid(),
  official_openid text not null unique,
  miniprogram_openid text not null unique,
  unionid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists wechat_task_identity_unionid_key
  on public.wechat_task_identity_bindings (unionid)
  where unionid is not null;

create table if not exists public.wechat_task_binding_codes (
  id uuid primary key default gen_random_uuid(),
  official_openid text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  miniprogram_openid text,
  created_at timestamptz not null default now()
);

create index if not exists wechat_task_binding_codes_openid_idx
  on public.wechat_task_binding_codes (official_openid, created_at desc);

alter table public.wechat_task_identity_bindings enable row level security;
alter table public.wechat_task_binding_codes enable row level security;

comment on column public.wechat_reminders.source is '任务创建来源：dimmo 或 miniprogram';
comment on table public.wechat_task_identity_bindings is '服务号与小程序微信身份的一对一绑定，仅服务端可访问';
comment on table public.wechat_task_binding_codes is 'Dimmo 生成的短时小程序绑定码，仅保存 SHA-256 摘要';
