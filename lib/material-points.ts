import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MaterialPointItem = { slug: string; cost: number };

export type MaterialPointClaim = {
  ok: boolean;
  code?: "INSUFFICIENT_POINTS";
  requiredPoints?: number;
  chargedPoints: number;
  pointsBalance: number;
  unlockedSlugs: string[];
};

export async function claimMaterialPoints(userId: string, materials: MaterialPointItem[]): Promise<MaterialPointClaim> {
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

  const { data, error } = await getSupabaseAdmin().rpc("unlock_materials_with_points", {
    p_user_id: userId,
    p_materials: normalized,
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
  };
}
