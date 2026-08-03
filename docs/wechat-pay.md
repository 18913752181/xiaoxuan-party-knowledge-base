# 微信支付会员配置

本项目使用微信支付 Native 扫码支付。邮箱验证码登录逻辑保持不变，支付订单与登录用户绑定。

## 1. 数据库

在 Supabase SQL Editor 执行：

`supabase/004_membership_orders.sql`

该迁移会创建订单表和幂等开通会员函数。支付成功后，会员有效期从当前有效期或付款时间（取较晚者）起顺延一年。

## 2. 微信支付商户平台

1. 开通 Native 支付。
2. 配置 API v3 密钥。
3. 准备商户 API 证书序列号和商户私钥。
4. 获取微信支付平台公钥及其序列号。
5. 确保回调地址可由公网 HTTPS 访问：
   `https://xiaoxuanvip.com/api/payments/wechat/notify`

## 3. 环境变量

将 `.env.local.example` 中的微信支付变量配置到正式环境。私钥和 API v3 密钥只能保存在服务端，不能使用 `NEXT_PUBLIC_` 前缀，也不能提交到 Git。

`MEMBERSHIP_ANNUAL_PRICE_CENTS` 的单位是分。修改价格后，应同时在运营侧确认展示价格与商户订单金额。

## 4. 验证

1. 登录普通用户账号。
2. 下载会员专属资料，点击“成为专属会员”。
3. 在会员支付页生成二维码，并用微信扫码付款。
4. 确认支付页自动显示支付成功。
5. 在 `/admin/orders` 检查订单状态和会员到期时间。
6. 再次下载会员专属资料，确认可以正常取得文件。

支付回调会验证微信签名、商户号、AppID 和订单金额，并通过数据库函数幂等开通会员；微信重复通知不会重复延长有效期。

## 5. JSAPI 支付（微信内一键支付，可选）

已认证微信服务号可启用 JSAPI 支付：用户在微信内置浏览器打开支付页时，点击"微信支付"直接唤起收银台，无需扫码。未配置时自动回退到 Native 扫码支付。

### 商户平台（pay.weixin.qq.com）

1. 产品中心 → 我的产品：开通 **JSAPI 支付**。
2. 产品中心 → AppID 账号管理：确认服务号 AppID 已与商户号绑定。

### 公众号后台（mp.weixin.qq.com）

1. 设置与开发 → 基本配置：获取 **AppSecret（开发者密码）**。
2. 设置与开发 → 公众号设置 → 功能设置 → **网页授权域名**：添加 `xiaoxuanvip.com`。
   校验文件 `MP_verify_*.txt` 放到 `public/` 目录后重新部署，使
   `https://xiaoxuanvip.com/MP_verify_*.txt` 可公开访问。

### 环境变量

```
WECHAT_OFFICIAL_APP_ID=     # 服务号 AppID；与 WECHAT_PAY_APP_ID 相同则留空
WECHAT_OFFICIAL_APP_SECRET= # 服务号 AppSecret
```

### 流程说明

1. 微信内点击"微信支付"→ 无 openid 时跳转 `/api/payments/wechat/oauth` 做 snsapi_base 静默授权。
2. 回调 `/api/payments/wechat/oauth/callback` 用 code 换 openid，写入 httpOnly Cookie（30 天），回到支付页自动唤起收银台。
3. `/api/payments/wechat/jsapi/orders` 创建 JSAPI 订单并返回收银台参数（商户私钥 RSA 签名）。
4. 前端 `WeixinJSBridge.invoke("getBrandPayRequest", ...)` 唤起收银台；支付结果仍由现有 notify 回调确认并开通会员。
