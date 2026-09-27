import "server-only";
import { getMembership } from "@/lib/membership";
import { claimMaterialQuota } from "@/lib/material-quota-store";

export type MaterialAccess = { allowed: boolean; paid: boolean; used: number; remaining: number; code?: string };

export async function authorizeMaterialAccess(accessToken: string, slug: string | null = null, batch = false, userId?: string): Promise<MaterialAccess> {
  if (!userId) throw new Error("缺少已验证的登录身份。");
  // Paid access depends on the existing verified membership, not the free quota table.
  const membership = await getMembership(userId, accessToken);
  if (membership.active) return { allowed: true, paid: true, used: 0, remaining: 0 };
  if (batch) return { allowed: false, paid: false, used: 0, remaining: 0, code: "BATCH_MEMBERSHIP_REQUIRED" };
  return claimMaterialQuota(userId, slug);
}

export function materialAccessMessage(access: MaterialAccess) {
  return access.code === "BATCH_MEMBERSHIP_REQUIRED"
    ? "批量下载仅限付费会员，请开通会员后使用。"
    : "普通会员的 5 份预览额度已用完，已预览的资料可继续查看。开通付费会员可预览全部资料。";
}
