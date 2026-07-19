# 小宣同志资料库微信小程序 MVP

这是现有「小宣同志资料库」网站项目下新增的小程序前台，不替代、不重建现有网站。

## 数据接入方案

### 方案 A：本地 content 导出 JSON（当前已实现）

- 主数据仍然维护在网站项目的 `content/` 文件夹。
- 执行导出脚本，把资料整理为 `miniprogram/data/materials.json`。
- 小程序直接读取本地 JSON 展示首页、资料列表、详情、收藏和下载入口。
- 下载链接暂时指向线上网站 API，例如：`https://xiaoxuan-party-knowledge-base.vercel.app/api/content-units/{slug}/download`。

生成命令：

```bash
npm run export:miniprogram
```

如需换成自己的线上站点，可指定：

```bash
set SITE_BASE_URL=https://your-domain.com
npm run export:miniprogram
```

### 方案 B：后续接 Supabase 数据库和 Storage

- 资料元数据进入 Supabase 数据库。
- 文件进入 Supabase Storage。
- 小程序通过云函数或后端 API 获取资料、收藏、下载记录。
- 适合正式运营后的在线后台、权限控制和下载统计。

第一阶段暂不实现方案 B。

## 微信开发者工具打开方式

1. 打开微信开发者工具。
2. 选择「导入项目」。
3. 项目目录选择本目录：`miniprogram/`。
4. AppID 可先选择测试号或填自己的小程序 AppID。
5. 本地预览下载时，在开发者工具右上角「详情」里勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」。

## 页面

- `pages/index/index`：首页，搜索、热门资料、专题入口。
- `pages/materials/materials`：资料列表，支持专题筛选和搜索。
- `pages/detail/detail`：资料详情，突出文件下载和收藏，展示适用场景、流程、政策依据、注意事项、FAQ、关联资料。
- `pages/me/me`：我的收藏、最近下载、登录状态占位。

## 测试下载

1. 先确认网站线上地址可访问。
2. 执行 `npm run export:miniprogram` 更新 `materials.json`。
3. 在微信开发者工具中打开小程序。
4. 点击资料卡片的「下载文件」。
5. 若提示域名问题，请先开启开发者工具的“不校验合法域名”。正式发布时，需要在小程序后台配置下载合法域名。
