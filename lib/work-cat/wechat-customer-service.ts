import "server-only";

type WechatApiResult = { errcode?: number; errmsg?: string; access_token?: string; expires_in?: number };

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string | null> | null = null;

async function getAccessToken(appId: string, appSecret: string) {
  if (!appId || !appSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (tokenInFlight) return tokenInFlight;

  tokenInFlight = (async () => {
    try {
      const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
      url.searchParams.set("grant_type", "client_credential");
      url.searchParams.set("appid", appId);
      url.searchParams.set("secret", appSecret);
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3500) });
      const data = await response.json() as WechatApiResult;
      if (!response.ok || !data.access_token) return null;
      cachedToken = {
        value: data.access_token,
        // 微信令牌通常有效 7200 秒；提前 5 分钟刷新，避免临界失效。
        expiresAt: Date.now() + Math.max(60, (data.expires_in || 7200) - 300) * 1000
      };
      return cachedToken.value;
    } catch {
      return null;
    }
  })();

  try {
    return await tokenInFlight;
  } finally {
    tokenInFlight = null;
  }
}

async function postCustomerService(path: string, body: Record<string, unknown>, appId: string, appSecret: string) {
  const accessToken = await getAccessToken(appId, appSecret);
  if (!accessToken) return false;
  try {
    const response = await fetch(`https://api.weixin.qq.com${path}?access_token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(3500)
    });
    const data = await response.json() as WechatApiResult;
    return response.ok && data.errcode === 0;
  } catch {
    return false;
  }
}

/** 显示微信原生“正在输入”状态；无客服接口权限时返回 false 并由调用方回退被动回复。 */
export function sendCustomerServiceTyping(openid: string, appId: string, appSecret: string) {
  return postCustomerService("/cgi-bin/message/custom/typing", { touser: openid, command: "Typing" }, appId, appSecret);
}

/** 在用户主动互动窗口内，以公众号客服消息发送文字。 */
export function sendCustomerServiceText(openid: string, content: string, appId: string, appSecret: string) {
  return postCustomerService("/cgi-bin/message/custom/send", {
    touser: openid,
    msgtype: "text",
    text: { content }
  }, appId, appSecret);
}
