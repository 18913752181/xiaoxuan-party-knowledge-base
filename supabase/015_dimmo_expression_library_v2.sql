-- 将黄色领巾版 5×5 总表作为第二套 Dimmo 表情加入后台。
-- 保留初始版记录；新素材仍只在后台管理，不增加前台读取策略。

insert into public.dimmo_expressions
  (name, slug, form, sprite_sheet_url, sprite_row, sprite_col, alt_text, tags, usage_note, sort_order, is_published)
select
  name || '（黄巾版）',
  'yellow-' || slug,
  form,
  '/images/dimmo-expression-library-v2.png',
  sprite_row,
  sprite_col,
  alt_text || '，黄色领巾版',
  tags || array['黄巾版'],
  usage_note || '；黄色领巾新版',
  sort_order + 25,
  is_published
from public.dimmo_expressions
where sprite_sheet_url = '/images/dimmo-expression-library-v1.png'
  and slug not like 'yellow-%'
on conflict (slug) do update set
  name = excluded.name,
  form = excluded.form,
  sprite_sheet_url = excluded.sprite_sheet_url,
  sprite_row = excluded.sprite_row,
  sprite_col = excluded.sprite_col,
  alt_text = excluded.alt_text,
  tags = excluded.tags,
  usage_note = excluded.usage_note,
  sort_order = excluded.sort_order,
  is_published = excluded.is_published;
