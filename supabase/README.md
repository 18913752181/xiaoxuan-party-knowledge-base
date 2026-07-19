# Supabase SQL 管理

本目录用于保存所有需要在 Supabase SQL Editor 中执行的数据库变更脚本。

## SQL 文件说明

- `schema.sql`：早期完整演示数据库脚本，包含 profiles、materials、favorites、downloads 等旧结构。当前资料内容已改为本地 `content/` 文件夹读取，不建议继续用它作为新增功能的唯一依据。
- `favorites.sql`：早期收藏表脚本，保留用于历史参考。
- `002_favorites.sql`：当前收藏功能使用的收藏表脚本。收藏只保存本地文章的 `article_slug`、标题和分类，不把文章正文迁移到 Supabase。

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
