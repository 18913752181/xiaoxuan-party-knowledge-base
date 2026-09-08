-- 会员基地攻略：只存储经人工核实或可靠来源整理的内容。
-- 空值由小程序显示为“待完善”，禁止以自动生成内容代替。

alter table public.education_bases
  add column if not exists opening_info text,
  add column if not exists reservation_info text,
  add column if not exists activity_formats text,
  add column if not exists suitable_audiences text,
  add column if not exists activity_route text,
  add column if not exists nearby_base_combinations text,
  add column if not exists activity_plan text,
  add column if not exists related_materials text;

comment on column public.education_bases.opening_info is '经可靠来源核实的开放时间、临时闭馆等信息；未知时留空';
comment on column public.education_bases.reservation_info is '经核实的预约方式、提前时间、团队人数等信息；未知时留空';
comment on column public.education_bases.activity_formats is '适合开展的活动形式，须由人工依据场馆条件维护';
comment on column public.education_bases.suitable_audiences is '适合人群，须由人工依据可靠资料维护';
comment on column public.education_bases.activity_route is '基地内部或单次活动路线建议，须由人工核实';
comment on column public.education_bases.nearby_base_combinations is '周边基地组合建议，须核对真实点位与开放情况';
comment on column public.education_bases.activity_plan is '活动方案正文或摘要，未知时留空';
comment on column public.education_bases.related_materials is '相关资料名称与链接，可使用换行分隔；未知时留空';
