-- 新增“任务协作”表情组：成年 Dimmo 25 个 + 煤球小黑猫 25 个。
-- 只写入后台表情库，不增加前台读取策略。

with actions(action_order, name, slug, usage_note, tags) as (
  values
    (1,  '出发啦',   'departure',       '开始行动、进入执行阶段',       array['行动','出发']),
    (2,  '重要通知', 'important-notice', '发布重要通知或强提醒',         array['通知','提醒']),
    (3,  '认真记录', 'serious-notes',    '记录重点、保存信息',           array['记录','工作']),
    (4,  '安排妥当', 'all-set',          '确认安排完成、交代清楚',       array['确认','安排']),
    (5,  '哇，好棒', 'amazing',          '赞叹成果、肯定用户',           array['赞美','惊喜']),
    (6,  '任务清单', 'task-list',        '展示待办或检查任务',           array['任务','清单']),
    (7,  '正在查找', 'searching',        '搜索资料、核对信息',           array['搜索','查找']),
    (8,  '思考一下', 'think-it-over',    '分析问题、准备回答',           array['思考','工作']),
    (9,  '开心',     'happy-task',       '收到好消息、轻松回应',         array['开心','回应']),
    (10, '感谢你',   'thank-you',        '表达感谢和温暖反馈',           array['感谢','关心']),
    (11, '学习中',   'studying',         '阅读学习、理解资料',           array['学习','阅读']),
    (12, '有办法了', 'got-an-idea',      '找到解决思路或新方案',         array['灵感','解决']),
    (13, '数据分析', 'data-analysis',    '讲解数据、汇报趋势',           array['数据','分析']),
    (14, '什么情况', 'what-happened',    '遇到异常、需要确认',           array['疑惑','异常']),
    (15, '马上处理', 'handle-now',       '立即响应消息或任务',           array['行动','消息']),
    (16, '压力山大', 'overwhelmed',      '任务繁重、压力反馈',           array['压力','疲惫']),
    (17, '晚安',     'good-night',       '夜间告别、休息提醒',           array['晚安','睡觉']),
    (18, '搞定啦',   'solved',           '问题解决、完成处理',           array['完成','庆祝']),
    (19, '拜托拜托', 'pretty-please',    '温柔请求用户配合',             array['请求','期待']),
    (20, '收到',     'received-box',     '确认收到任务或消息',           array['收到','确认']),
    (21, '抱歉嘛',   'sorry',            '出错道歉、柔和解释',           array['抱歉','安慰']),
    (22, '全力以赴', 'full-speed-work',  '高强度处理、集中工作',         array['工作','冲刺']),
    (23, '耶',       'yay',              '阶段成果、小型庆祝',           array['开心','庆祝']),
    (24, '完成',     'trophy-complete',  '任务达成、成果验收',           array['完成','奖杯']),
    (25, '冲鸭',     'pompom-cheer',     '鼓励用户继续前进',             array['加油','鼓励'])
), forms(form, sprite_sheet_url, sort_offset, form_tag) as (
  values
    ('adult',    '/images/dimmo-task-expression-adult-v1.png',    50, '成年'),
    ('coalball', '/images/dimmo-task-expression-coalball-v1.png', 75, '煤球')
)
insert into public.dimmo_expressions
  (name, slug, form, sprite_sheet_url, sprite_row, sprite_col, alt_text, tags, usage_note, sort_order, is_published)
select
  actions.name,
  'task-' || actions.slug || '-' || forms.form,
  forms.form,
  forms.sprite_sheet_url,
  (actions.action_order - 1) / 5,
  (actions.action_order - 1) % 5,
  'Dimmo ' || actions.name || '任务协作表情（' || forms.form_tag || '）',
  actions.tags || array['任务协作', forms.form_tag],
  actions.usage_note,
  forms.sort_offset + actions.action_order,
  true
from actions cross join forms
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
