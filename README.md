# 小宣同志党建资料库

这是一个面向基层党务工作者的党建资料库 MVP。当前项目基于 Next.js、Tailwind CSS 和 Supabase 构建。

资料内容仍然以项目根目录下的 `content/` 本地文件夹为主。Supabase 当前只用于登录、收藏等用户行为能力，不作为文章正文数据库。

## 本地运行

```powershell
cd C:\Users\17433\Desktop\xiaoxuan-party-knowledge-base
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 常用页面

```text
http://localhost:3000/
http://localhost:3000/library
http://localhost:3000/login
http://localhost:3000/user
http://localhost:3000/admin/new
```

## Supabase 配置

在项目根目录创建 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

修改环境变量后需要重启开发服务。

## 项目开发规范

请阅读：[DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)

## 数据库 SQL 管理

请阅读：[supabase/README.md](./supabase/README.md)

当前收藏功能对应 SQL：

```text
supabase/002_favorites.sql
```

## 知识单元生成器

后台生成页：

```text
http://localhost:3000/admin/new
```

后台生成的知识单元会写入：

```text
content/分类名/文章slug/
```

前台资料库、详情页和专题页会继续读取 `content/` 本地文件夹。
