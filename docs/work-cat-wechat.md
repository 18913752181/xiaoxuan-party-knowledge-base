# Dimmo「工作小猫」微信公众号接入

## 已实现范围

- `GET /api/wechat`：微信服务器 URL 验证，兼容明文与安全模式。
- `POST /api/wechat`：校验签名，接收文字消息，兼容明文 / AES 加密消息与加密回复。
- 已配置服务号 AppSecret 且具备客服消息接口权限时，先显示微信原生“正在输入”，再发送客服消息；不可用时自动回退到被动回复。
- 规则优先 + AI 结构化分类；专业党务关键词在调用 AI 前、AI 返回后各拦截一次。
- 对话、专业问题、提醒/留言写入现有 Supabase。
- `/admin/work-cat`：今日接待统计、待回复列表、上下文、状态处理、提醒留言。

图片、语音、主动推送、后台直接回复不在 V1 范围内。非文字消息暂时返回 `success`。

## 1. 数据库

在现有 Supabase 项目的 SQL Editor 中完整执行：

```text
supabase/008_work_cat.sql
```

脚本会创建 `wechat_users`、`wechat_conversations`、`pending_questions`、`wechat_reminders` 四张表及 RLS 策略。这里使用 `wechat_users`，避免与 Supabase Auth 用户概念混淆；`openid` 仍是服务号用户的唯一标识。

## 2. 环境变量

本地 `.env.local` 和正式服务器都需要：

```env
# 现有 Supabase（service role 只允许放服务端，绝不能 NEXT_PUBLIC_）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 微信服务号
WECHAT_TOKEN=请自行生成一段高强度随机字符串
WECHAT_ENCODING_AES_KEY=微信后台生成的43位EncodingAESKey
WECHAT_OFFICIAL_APP_ID=wx_your_official_account_appid
WECHAT_OFFICIAL_APP_SECRET=your_app_secret

# 工作小猫 AI（OpenAI-compatible chat/completions）
WORK_CAT_AI_API_KEY=your-ai-api-key
WORK_CAT_AI_BASE_URL=https://api.openai.com/v1
WORK_CAT_AI_MODEL=gpt-4.1-mini
```

`SUPABASE_URL` 是仅服务端地址，通常与 `NEXT_PUBLIC_SUPABASE_URL` 相同；未填写时自动回退到后者。兼容别名：回调也识别 `WECHAT_APP_ID`；AI 也会回退读取 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。没有配置 AI 时，固定接待/FAQ/资料/留言仍能工作；其余不确定消息会按专业问题转人工，不会越权。

`WECHAT_OFFICIAL_APP_SECRET` 不参与被动消息验签，但现有项目的微信网页授权会使用，仍应配置。FAQ 可在 `data/work-cat-faq.json` 直接维护。

## 3. 本地测试

1. 执行 SQL，创建 `.env.local`，其中 `WECHAT_TOKEN` 可先使用本地测试值。
2. 启动项目：

```powershell
npm install
npm run dev
```

3. 另开终端，确保测试终端里的 `WECHAT_TOKEN` 与 `.env.local` 一致：

```powershell
$env:WECHAT_TOKEN="和 .env.local 相同的 Token"
npm run test:work-cat
```

脚本会验证 URL，并分别发送“你好”和“支委会可以研究接收预备党员吗？”。测试终端同时配置了 `WECHAT_ENCODING_AES_KEY` 与 `WECHAT_OFFICIAL_APP_ID` 时，还会自动验证安全模式的消息加解密。成功后登录管理员账号打开：

```text
http://localhost:3000/admin/work-cat
```

应看到专业问题进入“待回复”，并能查看上下文。若要让微信后台访问本机，可用具备 HTTPS 公网地址的隧道，把测试地址设为 `https://你的临时域名/api/wechat`。

## 4. 微信公众平台配置

进入服务号后台的“设置与开发 → 基本配置 → 服务器配置”：

- URL：`https://xiaoxuanvip.com/api/wechat`
- Token：与服务器 `WECHAT_TOKEN` 完全一致
- EncodingAESKey：点击随机生成，并复制到 `WECHAT_ENCODING_AES_KEY`
- 消息加解密方式：推荐“安全模式”

先部署且确认 HTTPS 可访问，再点击“提交”。微信会请求 `GET /api/wechat` 完成校验。AppID 对应 `WECHAT_OFFICIAL_APP_ID`，AppSecret 对应 `WECHAT_OFFICIAL_APP_SECRET`；两者不要写入代码或提交到 Git。

## 5. 部署上线

项目沿用现有 Docker / Next.js standalone 部署，不需要新服务：

1. 在 Supabase 执行 `008_work_cat.sql`。
2. 把上述环境变量加入正式服务器 `/srv/xiaoxuan/shared/app.env`（或实际使用的部署平台环境变量）。
3. 执行现有部署流程，确认 `npm run build` 通过。
4. 用浏览器访问 `https://xiaoxuanvip.com/api/wechat`，无签名时返回 403 属于正常现象。
5. 在公众号后台提交服务器配置并启用。
6. 用真实微信分别发送“你好”和一个专业党务问题。
7. 登录 `/admin/work-cat` 检查今日数字、待回复记录和上下文。

## 6. 验收标准

- 普通链路：发送“你好” → 收到 Dimmo 的自然接待回复 → 后台对话中有 user/cat 两条消息 → 不产生 `pending_questions`。
- 专业链路：发送“支委会可以研究接收预备党员吗？” → 回复中不包含专业结论，只说明转交小宣 → `pending_questions.status=pending` → 后台可查看问题及上下文，并可标记已回复/关闭。
- 异常兜底：模型超时、返回非 JSON、未配置模型或分类不确定 → 默认专业问题，转交小宣。
- 重试去重：微信用同一 `MsgId` 重推时，不重复创建待回复记录，并复用第一次的回复内容。

注意：微信被动回复有严格超时要求。当前 AI 调用设置为 3.2 秒超时；生产 Supabase 和模型服务应保证国内服务器可稳定访问。若实测仍超时，V1 会继续依赖硬规则即时回复，后续可把 AI 分类改为队列异步处理。
