import "server-only";

import crypto from "crypto";
import fs from "fs";

const API_BASE = "https://api.mch.weixin.qq.com";

function env(name: string) {
  return (process.env[name] || "").trim();
}

function secretFromEnvOrFile(valueName: string, pathName: string) {
  const value = env(valueName);
  if (value) return value.replace(/\\n/g, "\n");
  const path = env(pathName);
  if (!path) return "";
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

function privateKey() {
  return secretFromEnvOrFile("WECHAT_PAY_PRIVATE_KEY", "WECHAT_PAY_PRIVATE_KEY_PATH");
}

function configuredPlatformPublicKey() {
  return secretFromEnvOrFile(
    "WECHAT_PAY_PLATFORM_PUBLIC_KEY",
    "WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH"
  );
}

export function annualPriceCents() {
  const value = Number(env("MEMBERSHIP_ANNUAL_PRICE_CENTS"));
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function wechatPayConfigured() {
  return Boolean(
    env("WECHAT_PAY_MCH_ID") &&
    env("WECHAT_PAY_APP_ID") &&
    env("WECHAT_PAY_SERIAL_NO") &&
    privateKey() &&
    env("WECHAT_PAY_API_V3_KEY") &&
    env("WECHAT_PAY_NOTIFY_URL") &&
    annualPriceCents()
  );
}

function authorization(method: string, path: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(message), privateKey()).toString("base64");
  return `WECHATPAY2-SHA256-RSA2048 mchid="${env("WECHAT_PAY_MCH_ID")}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${env("WECHAT_PAY_SERIAL_NO")}"`;
}

/**
 * Node 的 fetch 默认携带 "Accept-Language: *"，微信支付部分接口（如 /v3/certificates）
 * 会因此返回 406「传入了不支持的Accept-Language」，必须显式指定。
 */
function wechatApiHeaders(method: string, path: string, body: string) {
  return {
    Authorization: authorization(method, path, body),
    Accept: "application/json",
    "Accept-Language": "zh-CN",
    "Content-Type": "application/json",
    "User-Agent": "xiaoxuan-material-library/1.0"
  };
}

export async function createNativeOrder(input: {
  outTradeNo: string;
  description: string;
  amountTotal: number;
  notifyUrl?: string;
}) {
  if (!wechatPayConfigured()) throw new Error("微信支付尚未完成配置。");
  const path = "/v3/pay/transactions/native";
  const body = JSON.stringify({
    appid: env("WECHAT_PAY_APP_ID"),
    mchid: env("WECHAT_PAY_MCH_ID"),
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl || env("WECHAT_PAY_NOTIFY_URL"),
    amount: { total: input.amountTotal, currency: "CNY" }
  });
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: wechatApiHeaders("POST", path, body),
    body,
    cache: "no-store"
  });
  const result = await response.json();
  if (!response.ok || !result.code_url) {
    throw new Error(result.message || "微信支付下单失败。");
  }
  return result.code_url as string;
}

export type WechatOrderState = {
  trade_state?: string;
  transaction_id?: string;
  success_time?: string;
  amount?: { total?: number };
};

/** 主动向微信查询订单支付状态（回调之外的自愈通道）。 */
export async function queryNativeOrder(outTradeNo: string): Promise<WechatOrderState | null> {
  if (!wechatPayConfigured()) return null;
  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(env("WECHAT_PAY_MCH_ID"))}`;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: wechatApiHeaders("GET", path, ""),
    cache: "no-store"
  });
  if (!response.ok) return null;
  return (await response.json()) as WechatOrderState;
}

type PlatformCertificate = { serialNo: string; certificate: string };
let certificateCache: { expiresAt: number; items: PlatformCertificate[] } | null = null;

async function platformCertificates(): Promise<PlatformCertificate[]> {
  if (certificateCache && certificateCache.expiresAt > Date.now()) return certificateCache.items;

  const path = "/v3/certificates";
  const response = await fetch(`${API_BASE}${path}`, {
    headers: wechatApiHeaders("GET", path, ""),
    cache: "no-store"
  });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.data)) {
    throw new Error(result.message || "无法获取微信支付平台证书。");
  }

  const items = result.data.map((item: {
    serial_no: string;
    encrypt_certificate: { associated_data?: string; nonce: string; ciphertext: string };
  }) => ({
    serialNo: item.serial_no,
    certificate: String(decryptWechatResource(item.encrypt_certificate))
  }));
  certificateCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, items };
  return items;
}

async function notificationPublicKey(serial: string) {
  const configuredKey = configuredPlatformPublicKey();
  const configuredSerial = env("WECHAT_PAY_PLATFORM_SERIAL_NO");
  if (configuredKey && configuredSerial === serial) return configuredKey;
  const certificate = (await platformCertificates()).find((item) => item.serialNo === serial);
  return certificate?.certificate || "";
}

export async function verifyWechatNotification(headers: Headers, rawBody: string) {
  const timestamp = headers.get("wechatpay-timestamp") || "";
  const nonce = headers.get("wechatpay-nonce") || "";
  const signature = headers.get("wechatpay-signature") || "";
  const serial = headers.get("wechatpay-serial") || "";
  if (!timestamp || !nonce || !signature || !serial) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const publicKey = await notificationPublicKey(serial);
  if (!publicKey) return false;
  return crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${timestamp}\n${nonce}\n${rawBody}\n`),
    publicKey,
    Buffer.from(signature, "base64")
  );
}

export function decryptWechatResource(resource: {
  associated_data?: string;
  nonce: string;
  ciphertext: string;
}) {
  const key = Buffer.from(env("WECHAT_PAY_API_V3_KEY"), "utf8");
  if (key.length !== 32) throw new Error("WECHAT_PAY_API_V3_KEY 必须为 32 字节。");
  const payload = Buffer.from(resource.ciphertext, "base64");
  const ciphertext = payload.subarray(0, -16);
  const tag = payload.subarray(-16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce));
  decipher.setAuthTag(tag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data));
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  try {
    return JSON.parse(plaintext);
  } catch {
    return plaintext;
  }
}

export function wechatMerchantIdentity() {
  return { mchid: env("WECHAT_PAY_MCH_ID"), appid: env("WECHAT_PAY_APP_ID") };
}

// ---------- JSAPI（公众号）支付：微信内置浏览器一键唤起收银台 ----------

export function officialAppId() {
  // 服务号 AppID；未单独配置时回退到支付 AppID（两者通常是同一个服务号）
  return env("WECHAT_OFFICIAL_APP_ID") || env("WECHAT_PAY_APP_ID");
}

function officialAppSecret() {
  return env("WECHAT_OFFICIAL_APP_SECRET");
}

export function wechatJsapiConfigured() {
  return wechatPayConfigured() && Boolean(officialAppId() && officialAppSecret());
}

/** 支付回调可能携带 Native 或 JSAPI 下单时使用的任一 AppID，两者都应通过校验 */
export function wechatAcceptedAppIds() {
  return Array.from(new Set([env("WECHAT_PAY_APP_ID"), officialAppId()].filter(Boolean)));
}

function siteUrl() {
  return (env("NEXT_PUBLIC_SITE_URL") || "https://xiaoxuanvip.com").replace(/\/$/, "");
}

export function wechatOauthUrl(state: string) {
  const params = new URLSearchParams({
    appid: officialAppId(),
    redirect_uri: `${siteUrl()}/api/payments/wechat/oauth/callback`,
    response_type: "code",
    scope: "snsapi_base",
    state
  });
  return `https://open.weixin.qq.com/connect/oauth2/authorize?${params.toString()}#wechat_redirect`;
}

/** 用授权 code 换取用户在当前服务号下的 openid（snsapi_base 静默授权） */
export async function fetchWechatOpenid(code: string) {
  const params = new URLSearchParams({
    appid: officialAppId(),
    secret: officialAppSecret(),
    code,
    grant_type: "authorization_code"
  });
  const response = await fetch(`https://api.weixin.qq.com/sns/oauth2/access_token?${params.toString()}`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.openid) {
    throw new Error(result.errmsg ? `微信授权失败：${result.errmsg}` : "微信授权失败。");
  }
  return result.openid as string;
}

export async function createJsapiOrder(input: {
  outTradeNo: string;
  description: string;
  amountTotal: number;
  openid: string;
}) {
  if (!wechatJsapiConfigured()) throw new Error("微信内支付尚未完成配置。");
  const path = "/v3/pay/transactions/jsapi";
  const body = JSON.stringify({
    appid: officialAppId(),
    mchid: env("WECHAT_PAY_MCH_ID"),
    description: input.description,
    out_trade_no: input.outTradeNo,
    notify_url: env("WECHAT_PAY_NOTIFY_URL"),
    amount: { total: input.amountTotal, currency: "CNY" },
    payer: { openid: input.openid }
  });
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: wechatApiHeaders("POST", path, body),
    body,
    cache: "no-store"
  });
  const result = await response.json();
  if (!response.ok || !result.prepay_id) {
    throw new Error(result.message || "微信支付下单失败。");
  }
  return result.prepay_id as string;
}

/** 生成前端 WeixinJSBridge 唤起收银台所需的参数（paySign 用商户私钥 RSA-SHA256 签名） */
export function signJsapiPayParams(prepayId: string) {
  const appId = officialAppId();
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = crypto.randomBytes(16).toString("hex");
  const packageStr = `prepay_id=${prepayId}`;
  const paySign = crypto
    .sign("RSA-SHA256", Buffer.from(`${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`), privateKey())
    .toString("base64");
  return { appId, timeStamp, nonceStr, package: packageStr, signType: "RSA", paySign };
}
