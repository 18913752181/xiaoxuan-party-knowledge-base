import "server-only";
import { getMembership } from "@/lib/membership";
import { getMaterialPointState } from "@/lib/material-point-state";

export type MaterialAccess = { allowed: boolean; paid: boolean; used: number; remaining: number; code?: string };

export async function authorizeMaterialAccess(accessToken: string, slug: string | null = null, batch = false, userId?: string): Promise<MaterialAccess> {
  if (!userId) throw new Error("缺少已验证的登录身份。");
  // Paid access depends on the existing verified membership, not the free quota table.
  const membership = await getMembership(userId, accessToken);
  const state = await getMaterialPointState(userId);
  if (state.policy === "annual_daily") return {
    allowed: state.canDownload === true, paid: state.canDownload === true,
    used: state.dailyUsed ?? 0, remaining: state.dailyRemaining ?? 0,
    code: state.canDownload ? undefined : "ANNUAL_MEMBERSHIP_REQUIRED"
  };
  if (membership.active) return { allowed: true, paid: true, used: 0, remaining: 0 };
  if (batch) return { allowed: false, paid: false, used: 0, remaining: 0, code: "BATCH_MEMBERSHIP_REQUIRED" };
  return { allowed: true, paid: false, used: 0, remaining: 0 };
}

export function materialAccessMessage(access: MaterialAccess) {
  if (access.code === "ANNUAL_MEMBERSHIP_REQUIRED") return "新会员仅年卡可下载资料，月卡和季卡不含资料库下载权限。老会员保留原权益。";
  return access.code === "BATCH_MEMBERSHIP_REQUIRED"
    ? "批量下载仅限付费会员，请开通会员后使用。"
    : "会员专属资料仅付费会员可下载。";
}
