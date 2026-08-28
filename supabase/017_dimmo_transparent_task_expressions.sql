-- 将已写入数据库的任务场景表情切换到真正透明背景的角色总表。
-- 本迁移可重复执行。

update public.dimmo_expressions
set sprite_sheet_url = case sprite_sheet_url
  when '/images/dimmo-task-expression-adult-v1.png'
    then '/images/dimmo-task-expression-adult-transparent-v2.png'
  when '/images/dimmo-task-expression-coalball-v1.png'
    then '/images/dimmo-task-expression-coalball-transparent-v2.png'
  else sprite_sheet_url
end
where sprite_sheet_url in (
  '/images/dimmo-task-expression-adult-v1.png',
  '/images/dimmo-task-expression-coalball-v1.png'
);
