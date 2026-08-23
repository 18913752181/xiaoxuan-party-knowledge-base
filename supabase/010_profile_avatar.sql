-- 010_profile_avatar.sql
-- 为用户资料增加可选头像键。已有用户保持 NULL，前端会按 user id 稳定分配默认头像；
-- 只有用户主动选择后才写入，因此不会改动现有账号资料。

alter table public.profiles
  add column if not exists avatar_key text;

alter table public.profiles
  drop constraint if exists profiles_avatar_key_check;

alter table public.profiles
  add constraint profiles_avatar_key_check
  check (avatar_key is null or avatar_key in ('terracotta', 'mist', 'moss', 'plum', 'sky', 'amber'));
