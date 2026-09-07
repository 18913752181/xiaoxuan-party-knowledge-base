-- 教育基地配图：后台上传和编辑，小程序通过 xiaoxuanvip.com 同域图片接口读取。

alter table public.education_bases
  add column if not exists image_url text,
  add column if not exists image_storage_path text,
  add column if not exists image_alt text,
  add column if not exists image_source_url text,
  add column if not exists image_rights_status text default 'unknown';

alter table public.education_bases
  drop constraint if exists education_bases_image_rights_status_check;

alter table public.education_bases
  add constraint education_bases_image_rights_status_check
  check (image_rights_status is null or image_rights_status in ('owned', 'licensed', 'reference-only', 'unknown'));

comment on column public.education_bases.image_url is '后台配图网址；站内图片可保存为 /api 或 /images 开头的相对地址';
comment on column public.education_bases.image_storage_path is 'education-base-images 存储桶中的文件路径';
comment on column public.education_bases.image_alt is '图片无障碍说明';
comment on column public.education_bases.image_source_url is '实景参考或图片来源页面';
comment on column public.education_bases.image_rights_status is '图片权利状态：owned/licensed/reference-only/unknown';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('education-base-images', 'education-base-images', false, 6291456, array['image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update public.education_bases set
  image_url = '/images/education-bases/base-14-suzhou-independent-branch-cover.jpg',
  image_alt = '中共苏州独立支部旧址建筑插画',
  image_source_url = 'https://dfzb.suzhou.gov.cn/dfzb/szdq/202407/e6402ccd3ebf482a8c372e12d657a341.shtml',
  image_rights_status = 'reference-only'
where id = 14 and image_url is null;

update public.education_bases set
  image_url = '/images/education-bases/base-30-suzhou-planning-exhibition-cover.jpg',
  image_alt = '苏州市规划展示馆建筑插画',
  image_source_url = 'https://yunghzg.cn/default.aspx/?RoomID=41',
  image_rights_status = 'reference-only'
where id = 30 and image_url is null;

update public.education_bases set
  image_url = '/images/education-bases/taihu-guerrilla-memorial-illustration-hd.jpg',
  image_alt = '新四军太湖游击队纪念馆建筑插画',
  image_rights_status = 'reference-only'
where id = 95 and image_url is null;

update public.education_bases set
  image_url = '/images/education-bases/park-experience-motif.jpg',
  image_alt = '园区经验教育基地插画',
  image_rights_status = 'reference-only'
where id = 113 and image_url is null;
