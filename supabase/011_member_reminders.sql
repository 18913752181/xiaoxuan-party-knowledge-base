-- Dimmo 会员到点提醒：在原有留言表上增加计划时间与投递状态。
alter table public.wechat_reminders
  add column if not exists scheduled_at timestamptz,
  add column if not exists dispatched_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists attempts integer not null default 0,
  add column if not exists delivery_error text;

alter table public.wechat_reminders
  drop constraint if exists wechat_reminders_status_check;

alter table public.wechat_reminders
  add constraint wechat_reminders_status_check
  check (status in ('pending', 'scheduled', 'sent', 'failed', 'done', 'closed'));

create index if not exists wechat_reminders_scheduled_idx
  on public.wechat_reminders (status, scheduled_at asc)
  where status = 'scheduled';

comment on column public.wechat_reminders.scheduled_at is '会员定时提醒的计划发送时间（UTC）';
comment on column public.wechat_reminders.dispatched_at is '公众号消息实际发送成功时间';
