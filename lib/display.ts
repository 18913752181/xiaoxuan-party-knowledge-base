/**
 * 账号展示辅助：微信一键登录生成的是 wx_<openid>@wx.xiaoxuanvip.com 伪邮箱，
 * 任何面向用户的界面都不应直接展示它。
 */
export const WECHAT_EMAIL_SUFFIX = "@wx.xiaoxuanvip.com";

export function maskAccountEmail(email?: string | null) {
  if (!email) return "";
  return email.endsWith(WECHAT_EMAIL_SUFFIX) ? "微信用户" : email;
}
