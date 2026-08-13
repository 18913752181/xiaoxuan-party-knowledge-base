import "server-only";

import crypto from "crypto";
import { authFetch, recordLoginEvent } from "@/lib/server-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * 微信一键登录（服务号网页授权 snsapi_base）。
 *
 * 两种账号形态：
 * 1. 纯微信账号：微信用户没有邮箱，账号系统（Supabase Auth）以邮箱为主键，
 *    因此为每个 openid 生成伪邮箱账号 wx_<openid>@wx.xiaoxuanvip.com。
 *    密码由服务端用 HMAC 从 openid 确定性推导，不落库、不传输，
 *    用户侧永远无感——他们在微信里点一下就完成注册/登录。
 * 2. 绑定微信的邮箱账号：profiles.wechat_openid 指向已有邮箱账号时，
 *    微信一键登录直接进入该邮箱账号，会员状态、收藏等数据完全保留。
 */

export const WECHAT_EMAIL_SUFFIX = "@wx.xiaoxuanvip.com";

export function isWechatAccount(email?: string | null) {
  return Boolean(email && email.endsWith(WECHAT_EMAIL_SUFFIX));
}

function pseudoEmail(openid: string) {
  return `wx_${openid}${WECHAT_EMAIL_SUFFIX}`;
}

/** 确定性推导账号密码：同一 openid 恒定，无需存储，泄露面等于 service key 本身 */
function derivedPassword(openid: string) {
  const secret = process.env.WECHAT_LOGIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return crypto.createHmac("sha256", secret).update(`wechat-login:${openid}`).digest("hex");
}

type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user?: { id: string; email?: string };
};

export type WechatBinding = {
  userId: string;
  email: string;
  /** true = 微信一键登录自动创建的伪邮箱账号 */
  isPseudoAccount: boolean;
  memberStatus: string | null;
  memberExpiresAt: string | null;
};

/** 按 openid 查询 profiles 中的微信绑定记录（未绑定返回 null） */
export async function findWechatBinding(openid: string): Promise<WechatBinding | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from("profiles")
      .select("id,email,member_status,member_expires_at")
      .eq("wechat_openid", openid)
      .maybeSingle();
    if (error || !data) return null;
    return {
      userId: data.id as string,
      email: (data.email as string) || "",
      isPseudoAccount: isWechatAccount(data.email as string),
      memberStatus: (data.member_status as string) || null,
      memberExpiresAt: (data.member_expires_at as string) || null
    };
  } catch {
    return null;
  }
}

async function passwordSignIn(email: string, password: string): Promise<AuthTokens | null> {
  try {
    const response = await authFetch("/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) return null;
    const tokens = (await response.json()) as AuthTokens;
    return tokens.access_token && tokens.user?.id ? tokens : null;
  } catch {
    return null;
  }
}

/**
 * 为已绑定微信的邮箱账号签发会话：
 * admin 生成 magiclink 取出 token_hash，再兑换成 access/refresh token。
 * 不需要用户密码，全程服务端完成。
 */
async function boundAccountSignIn(email: string): Promise<AuthTokens | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return null;

    const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink"
    });
    const session = verified?.session;
    if (verifyError || !session?.access_token || !session.user?.id) return null;

    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: { id: session.user.id, email: session.user.email ?? email }
    };
  } catch {
    return null;
  }
}

async function createWechatUser(email: string, password: string, openid: string) {
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { provider: "wechat", wechat_openid: openid }
  });
  // 并发或重试导致“用户已存在”不算失败，后续直接走密码登录
  if (error && !/already|exists|duplicate/i.test(error.message)) {
    throw new Error(error.message);
  }
}

/**
 * 用微信 openid 登录（首次自动注册），返回 Supabase 会话令牌。
 * 失败抛错，由调用方转成用户可读提示。
 */
export async function loginWithWechatOpenid(openid: string): Promise<AuthTokens> {
  // 该微信已绑定邮箱账号：直接登录邮箱账号，会员/收藏等全部沿用
  const binding = await findWechatBinding(openid);
  if (binding && !binding.isPseudoAccount) {
    const boundTokens = await boundAccountSignIn(binding.email);
    if (boundTokens?.user?.id) {
      try {
        await recordLoginEvent(boundTokens.access_token, boundTokens.user.id);
      } catch {
        // 统计失败不影响登录
      }
      return boundTokens;
    }
    throw new Error("该微信绑定的邮箱账号登录失败，请改用邮箱验证码登录。");
  }

  const email = pseudoEmail(openid);
  const password = derivedPassword(openid);

  let tokens = await passwordSignIn(email, password);
  if (!tokens) {
    await createWechatUser(email, password, openid);
    tokens = await passwordSignIn(email, password);
  }
  if (!tokens || !tokens.user?.id) {
    throw new Error("微信登录失败，请稍后重试。");
  }

  // 补一份 profiles 记录（存在则只更新邮箱/昵称/openid，不动会员等字段）
  try {
    const admin = getSupabaseAdmin();
    await admin
      .from("profiles")
      .upsert({ id: tokens.user.id, email, nickname: "微信用户", wechat_openid: openid }, { onConflict: "id" });
  } catch {
    // 资料记录失败不影响登录
  }

  try {
    await recordLoginEvent(tokens.access_token, tokens.user.id);
  } catch {
    // 统计失败不影响登录
  }

  return tokens;
}
