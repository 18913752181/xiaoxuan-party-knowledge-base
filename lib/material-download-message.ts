import type { MaterialPointClaim } from "@/lib/material-points";

export function materialClaimError(claim: MaterialPointClaim) {
  if (claim.code === "ANNUAL_MEMBERSHIP_REQUIRED") return "新会员仅年卡可下载资料，月卡和季卡不含资料库下载权限。老会员保留原权益。";
  if (claim.code === "DAILY_DOWNLOAD_LIMIT") return `每天最多下载10个不同文件，今日已下载 ${claim.dailyUsed ?? 0} 个，剩余 ${claim.dailyRemaining ?? 0} 个，本次还需 ${claim.requestedNew ?? 0} 个名额。请减少选择或明天再来；今日下载过的资料仍可重复下载。`;
  if (claim.code === "POINTS_QUOTE_CHANGED") return "资料所需积分已变化，请重新确认后下载。";
  return `积分不足，本次需要 ${claim.requiredPoints ?? 0} 积分，现有 ${claim.pointsBalance} 积分，还差 ${Math.max(0, (claim.requiredPoints ?? 0) - claim.pointsBalance)} 积分。`;
}
