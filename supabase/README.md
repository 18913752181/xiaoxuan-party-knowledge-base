# Supabase SQL 管理

本目录用于保存所有需要在 Supabase SQL Editor 中执行的数据库变更脚本。

## SQL 文件说明

- `schema.sql`：早期完整演示数据库脚本，包含 profiles、materials、favorites、downloads 等旧结构。当前资料内容已改为本地 `content/` 文件夹读取，不建议继续用它作为新增功能的唯一依据。
- `favorites.sql`：早期收藏表脚本，保留用于历史参考。
- `002_favorites.sql`：当前收藏功能使用的收藏表脚本。收藏只保存本地文章的 `article_slug`、标题和分类，不把文章正文迁移到 Supabase。
- `007_wechat_binding.sql`：微信登录/绑定支持。为 `profiles` 增加 `wechat_openid` 字段（部分唯一索引），用于微信一键登录与邮箱账号绑定微信。
- `008_work_cat.sql`：Dimmo「工作小猫」服务号消息、对话、专业问题转人工与提醒留言表。
- `014_dimmo_expressions.sql`：创建 Dimmo 表情库数据表、公开读取策略、图片存储桶，并写入首批表情数据。
- `015_dimmo_expression_library_v2.sql`：补充第二版 Dimmo 表情图集数据。
- `016_dimmo_task_expression_library.sql`：补充任务协作场景下的成年 Dimmo 与煤球表情数据。
- `017_dimmo_transparent_task_expressions.sql`：把任务场景表情从带棋格底图的旧素材迁移到透明背景素材。
- `017_education_base_guides.sql`：增加教育基地讲解服务、费用、公开来源和核验日期字段，并导入首批已核实资料；未查到的信息保持为空。

## 如何执行 SQL

1. 打开 Supabase 项目后台。
2. 进入 `SQL Editor`。
3. 打开本目录中的目标 SQL 文件。
4. 复制文件全部内容到 SQL Editor。
5. 点击 `Run` 执行。

## 新增数据库表规范

新增数据库表或修改数据库结构时，必须在 `supabase/` 文件夹中新建编号 SQL 文件，例如：

- `001_profiles.sql`
- `002_favorites.sql`
- `003_downloads.sql`

不允许只口头提示“执行某某 SQL”。必须确保对应 SQL 文件真实存在，并在 README 中说明用途。
