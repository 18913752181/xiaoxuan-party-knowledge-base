# 微信登录与微信绑定

网站支持两种登录方式，新用户二选一，老用户权益不受影响：

1. **邮箱验证码登录**（原有方式，全平台可用）。
2. **微信一键登录**（微信内置浏览器中，服务号网页授权 `snsapi_base` 静默授权，无需用户确认）。

## 账号模型

- 账号体系以 Supabase Auth 邮箱为主键。纯微信用户首次一键登录时，服务端为其创建
  `wx_<openid>@wx.xiaoxuanvip.com` 伪邮箱账号（密码由 HMAC 从 openid 确定性推导，不落库），
  该伪邮箱永不展示给用户（前端统一用 `lib/display.ts` 的 `maskAccountEmail` 显示为"微信用户"）。
- `profiles.wechat_openid` 记录账号绑定的微信 openid（见 `supabase/007_wechat_binding.sql`，
  部分唯一索引，一个微信只能绑一个账号）。

## 流程

### 微信一键登录

- `GET /api/auth/wechat?return=/user`：浏览器已有 `wx_openid` Cookie 时直接登录，零跳转；
  否则跳转微信授权。
- `GET /api/auth/wechat/callback`：code 换 openid → `loginWithWechatOpenid()`：
  - openid 已绑定邮箱账号 → 通过 admin generateLink + verifyOtp 为该邮箱账号签发会话，
    会员、收藏等全部沿用；
  - 否则走伪邮箱账号密码登录，首次自动注册。
- 登录成功后写 30 天会话 Cookie 和 `wx_openid` Cookie（后续微信内支付免授权）。

### 绑定微信（已登录邮箱账号）

- 个人页 `/user` → "绑定微信"（仅微信内置浏览器显示按钮）→ `GET /api/auth/wechat/bind`
  → 授权回调 `/api/auth/wechat/bind/callback` 把 openid 写入当前账号。
- 特殊情况：该微信之前一键登录自动建过伪邮箱账号的，绑定时 openid 迁移到当前邮箱账号；
  伪账号若仍是有效付费会员，会员合并到邮箱账号（取更晚到期日）。
- 该微信已绑定**其他邮箱账号**时拒绝绑定，提示先解绑。
- 解绑：`POST /api/auth/wechat/unbind`。纯微信账号（伪邮箱）不允许解绑（微信是其唯一登录方式）。

## 环境变量

- `WECHAT_OFFICIAL_APP_ID`：服务号 AppID（缺省回退 `WECHAT_PAY_APP_ID`）。
- `WECHAT_OFFICIAL_APP_SECRET`：服务号 AppSecret（必填，授权换 openid 用）。
- `WECHAT_LOGIN_SECRET`：推导微信账号密码的 HMAC 密钥（缺省回退 `SUPABASE_SERVICE_ROLE_KEY`）。
- 服务号后台需把站点域名配置为**网页授权域名**，否则授权跳转会被微信拦截。

## 数据库

部署前在 Supabase SQL Editor 执行 `supabase/007_wechat_binding.sql`。

## 限制

- 微信一键登录依赖服务号网页授权，**仅微信内置浏览器可用**；桌面/普通浏览器访问登录页时
  只显示邮箱验证码入口和提示文案。如需桌面扫码登录，需另行申请微信开放平台"网站应用"。
