-- 007_wechat_binding.sql
-- 微信登录 / 微信绑定支持：
--   profiles.wechat_openid 记录账号绑定的微信 openid（服务号 snsapi_base 授权获得）。
--   - 微信一键登录自动创建的账号（wx_<openid>@wx.xiaoxuanvip.com 伪邮箱）也会写入该字段；
--   - 已有邮箱账号可在个人页绑定微信，绑定后微信一键登录直接进入邮箱账号，
--     原有会员状态（免费/付费）与收藏等数据完全保留。
-- 在 Supabase SQL Editor 中整段执行。

alter table public.profiles
  add column if not exists wechat_openid text;

-- 一个微信只能绑定一个账号（未绑定的 NULL 不参与唯一约束）
create unique index if not exists profiles_wechat_openid_key
  on public.profiles (wechat_openid)
  where wechat_openid is not null;

comment on column public.profiles.wechat_openid is '绑定的微信 openid（服务号网页授权），用于微信一键登录';
