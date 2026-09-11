-- 教育基地攻略聚焦字段：仅保存由宣知人工整理的简短使用提示。
-- 事实类信息继续使用既有的联系、预约、开放和讲解字段；未知时保持空值。

alter table public.education_bases
  add column if not exists usage_tips text;

comment on column public.education_bases.usage_tips is
  '宣知人工整理的基地使用提示，每行一条，建议 3—5 条；不得冒充基地官方信息';
