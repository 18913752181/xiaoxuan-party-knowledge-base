import "server-only";
import { getMembership } from "@/lib/membership";

export type MaterialAccess = { allowed: boolean; paid: boolean; used: number; remaining: number; code?: string };

export async function authorizeMaterialAccess(accessToken: string, slug: string | null = null, batch = false, userId?: string): Promise<MaterialAccess> {
  if (!userId) throw new Error("缺少已验证的登录身份。");
  // Paid access depends on the existing verified membership, not the free quota table.
  const membership = await getMembership(userId, accessToken);
  if (membership.active) return { allowed: true, paid: true, used: 0, remaining: 0 };
  if (batch) return { allowed: false, paid: false, used: 0, remaining: 0, code: "BATCH_MEMBERSHIP_REQUIRED" };
  return { allowed: true, paid: false, used: 0, remaining: 0 };
}

export function materialAccessMessage(access: MaterialAccess) {
  return access.code === "BATCH_MEMBERSHIP_REQUIRED"
    ? "批量下载仅限付费会员，请开通会员后使用。"
    : "会员专属资料仅付费会员可下载。";
}
