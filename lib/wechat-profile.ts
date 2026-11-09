const WECHAT_AVATAR_HOSTS = new Set(["thirdwx.qlogo.cn", "wx.qlogo.cn"]);

export function wechatAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024) return null;
  try {
    const url = new URL(value);
    if (!WECHAT_AVATAR_HOSTS.has(url.hostname) || url.port || url.username || url.password
      || !["http:", "https:"].includes(url.protocol) || !/^\/mmopen\//.test(url.pathname)) return null;
    url.protocol = "https:";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

export function wechatNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim();
  return Array.from(name).slice(0, 64).join("") || null;
}

export function wechatLoginReturn(value?: string | null): string {
  return value && /^\/(?!\/)[a-z0-9/_\-?=&%.]*$/i.test(value) ? value : "/user";
}
