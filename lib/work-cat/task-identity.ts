import "server-only";

import { createHash, randomInt } from "node:crypto";
import { membershipIsActive } from "@/lib/membership";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const BINDING_TTL_MS = 10 * 60_000;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function createTaskBindingCode(officialOpenid: string) {
  const admin = getSupabaseAdmin();
  const code = String(randomInt(10000000, 100000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BINDING_TTL_MS).toISOString();

  await admin
    .from("wechat_task_binding_codes")
    .delete()
    .eq("official_openid", officialOpenid)
    .is("used_at", null);

  const { error } = await admin.from("wechat_task_binding_codes").insert({
    official_openid: officialOpenid,
    code_hash: hashCode(code),
    expires_at: expiresAt
  });
  if (error) throw error;
  return { code, expiresAt };
}

export type MiniProgramIdentity = {
  miniprogramOpenid: string;
  unionid: string | null;
};

type MiniProgramSessionPayload = {
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

export async function exchangeMiniProgramCode(code: string): Promise<MiniProgramIdentity> {
  const appId = (process.env.WECHAT_MINIPROGRAM_APP_ID || "wxfa7b15cdbb16a761").trim();
  const secret = process.env.WECHAT_MINIPROGRAM_APP_SECRET?.trim() || "";
  if (!secret) throw new Error("WECHAT_MINIPROGRAM_APP_SECRET is not configured");
  if (!code.trim()) throw new Error("missing wx.login code");

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code.trim());
  url.searchParams.set("grant_type", "authorization_code");
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  const payload = await response.json() as MiniProgramSessionPayload;
  if (!response.ok || payload.errcode || !payload.openid) {
    console.warn("[mini-tasks] jscode2session failed", { status: response.status, errcode: payload.errcode });
    throw new Error("微信登录校验失败");
  }
  return { miniprogramOpenid: payload.openid, unionid: payload.unionid || null };
}

export async function bindMiniProgramIdentity(identity: MiniProgramIdentity, code: string) {
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: bindingCode, error: codeError } = await admin
    .from("wechat_task_binding_codes")
    .select("id,official_openid,expires_at,used_at")
    .eq("code_hash", hashCode(code.trim()))
    .maybeSingle();
  if (codeError) throw codeError;
  if (!bindingCode || bindingCode.used_at || new Date(bindingCode.expires_at).getTime() <= Date.now()) {
    return { ok: false as const, reason: "绑定码无效或已过期" };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("member_status,member_expires_at")
    .eq("wechat_openid", bindingCode.official_openid)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !membershipIsActive(profile.member_status, profile.member_expires_at)) {
    return { ok: false as const, reason: "该微信尚未绑定有效会员账号" };
  }

  // 先原子占用绑定码，避免两个小程序账号同时提交同一码时后者覆盖前者。
  const { data: claimedCode, error: claimError } = await admin
    .from("wechat_task_binding_codes")
    .update({ used_at: now, miniprogram_openid: identity.miniprogramOpenid })
    .eq("id", bindingCode.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimedCode) return { ok: false as const, reason: "绑定码已被使用，请重新向 Dimmo 获取" };

  const { data: conflicting, error: conflictError } = await admin
    .from("wechat_task_identity_bindings")
    .select("official_openid,miniprogram_openid")
    .or(`official_openid.eq.${bindingCode.official_openid},miniprogram_openid.eq.${identity.miniprogramOpenid}`);
  if (conflictError) throw conflictError;
  if ((conflicting || []).some((item) =>
    item.official_openid !== bindingCode.official_openid || item.miniprogram_openid !== identity.miniprogramOpenid
  )) {
    return { ok: false as const, reason: "该微信已绑定其他账号，请先联系客服处理" };
  }

  const { error: bindingError } = await admin.from("wechat_task_identity_bindings").upsert({
    official_openid: bindingCode.official_openid,
    miniprogram_openid: identity.miniprogramOpenid,
    unionid: identity.unionid,
    updated_at: now
  }, { onConflict: "official_openid" });
  if (bindingError) throw bindingError;
  return { ok: true as const, officialOpenid: bindingCode.official_openid };
}

export async function resolveMiniProgramUser(identity: MiniProgramIdentity) {
  const admin = getSupabaseAdmin();
  const { data: binding, error } = await admin
    .from("wechat_task_identity_bindings")
    .select("official_openid")
    .eq("miniprogram_openid", identity.miniprogramOpenid)
    .maybeSingle();
  if (error) throw error;
  if (!binding?.official_openid) return { bound: false as const, active: false as const };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("member_status,member_expires_at")
    .eq("wechat_openid", binding.official_openid)
    .maybeSingle();
  if (profileError) throw profileError;
  return {
    bound: true as const,
    active: membershipIsActive(profile?.member_status, profile?.member_expires_at),
    officialOpenid: binding.official_openid
  };
}
