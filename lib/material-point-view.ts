export type MaterialPointState = {
  paid: boolean;
  legacyBenefits: boolean;
  pointsBalance: number;
  unlockedSlugs: string[];
  policy?: "legacy_free" | "legacy_points" | "annual_daily";
  canDownload?: boolean;
  permanentPoints?: number;
  dailyPoints?: number;
  dailyLimit?: number | null;
  dailyUsed?: number;
  dailyRemaining?: number;
  todayDownloadedSlugs?: string[];
  annualExpiresAt?: string | null;
  planCode?: "monthly" | "quarterly" | "annual" | null;
  day?: string;
};

export function quoteMaterialPoints(state: MaterialPointState, items: { slug: string; cost: number }[]) {
  const unique = Array.from(new Map(items.map((item) => [item.slug, item])).values());
  const unlocked = new Set(state.unlockedSlugs);
  const requiredPoints = state.legacyBenefits ? 0 : unique.reduce((sum, item) => sum + (unlocked.has(item.slug) ? 0 : item.cost), 0);
  const todayDownloaded = new Set(state.todayDownloadedSlugs || []);
  const requestedNew = state.policy === "annual_daily" ? unique.filter((item) => !todayDownloaded.has(item.slug)).length : 0;
  return {
    slugs: unique.map((item) => item.slug),
    requiredPoints,
    pointsBalance: state.pointsBalance,
    shortfallPoints: Math.max(0, requiredPoints - state.pointsBalance),
    unlockedCount: unique.filter((item) => unlocked.has(item.slug)).length,
    legacyBenefits: state.legacyBenefits,
    dailyLimit: state.dailyLimit ?? null,
    dailyRemaining: state.dailyRemaining ?? 0,
    requestedNew,
    dailyExceeded: state.policy === "annual_daily" && requestedNew > (state.dailyRemaining ?? 0),
  };
}
export type MaterialPointQuote = ReturnType<typeof quoteMaterialPoints>;

export function materialDownloadLabel(state: MaterialPointState | null, slug: string, cost: number, memberOnly = false) {
  if (state?.policy === "annual_daily" && !state.canDownload) return "开通年卡下载";
  if (state && memberOnly && !state.paid) return "开通会员下载";
  if (state?.legacyBenefits) return "原会员权益，免扣积分";
  if (state?.unlockedSlugs.includes(slug)) return "已解锁，免费下载";
  return `下载 · ${cost}积分`;
}
