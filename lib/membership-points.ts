import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type DailyPointGrantResult = {
  throughDate: string;
  grantedCount: number;
  totalPoints: number;
  updatedUsers: number;
};

/**
 * 补齐截至指定日期尚未发放的年度会员每日积分。
 * 数据库函数以 user + date 作为唯一业务键，多进程并发调用也只会发放一次。
 */
export async function grantDueAnnualMembershipPoints(throughDate = new Date().toISOString().slice(0, 10)) {
  const { data, error } = await getSupabaseAdmin().rpc("grant_due_annual_membership_points", {
    p_through_date: throughDate
  });
  if (error) throw new Error(error.message);
  return data as DailyPointGrantResult;
}
