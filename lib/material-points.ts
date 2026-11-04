import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MaterialPointItem = { slug: string; cost: number };

export type MaterialPointClaim = {
  ok: boolean;
  code?: "INSUFFICIENT_POINTS" | "DAILY_DOWNLOAD_LIMIT" | "ANNUAL_MEMBERSHIP_REQUIRED" | "POINTS_QUOTE_CHANGED";
  requiredPoints?: number;
  chargedPoints: number;
  pointsBalance: number;
  unlockedSlugs: string[];
  dailyRemaining?: number;
  dailyUsed?: number;
  dailyLimit?: number | null;
  requestedNew?: number;
};

export async function claimMaterialPoints(userId: string, materials: MaterialPointItem[], expectedPoints?: number): Promise<MaterialPointClaim> {
  const normalized = Array.from(
    new Map(
      materials
        .filter((item) => item.slug && Number.isInteger(item.cost) && item.cost >= 0 && item.cost <= 9999)
        .map((item) => [item.slug, { slug: item.slug, cost: item.cost }])
    ).values()
  );
  if (!normalized.length) {
    return { ok: true, chargedPoints: 0, pointsBalance: 0, unlockedSlugs: [] };
  }

  const { data, error } = await getSupabaseAdmin().rpc("claim_material_downloads", {
    p_user_id: userId,
    p_materials: normalized,
    p_expected_points: expectedPoints ?? null,
  });
  if (error) throw new Error(error.message);

  const result = (data || {}) as Partial<MaterialPointClaim>;
  return {
    ok: result.ok === true,
    code: result.code,
    requiredPoints: Number(result.requiredPoints || 0),
    chargedPoints: Number(result.chargedPoints || 0),
    pointsBalance: Number(result.pointsBalance || 0),
    unlockedSlugs: Array.isArray(result.unlockedSlugs) ? result.unlockedSlugs.map(String) : [],
    dailyRemaining: result.dailyRemaining,
    dailyUsed: result.dailyUsed,
    dailyLimit: result.dailyLimit,
    requestedNew: result.requestedNew,
  };
}
