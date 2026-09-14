export type TencentPoi = {
  poiId: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  category: string | null;
};

export type TencentPoiMatch = {
  nameSimilarity: number;
  cityMatch: boolean;
  districtMatch: boolean;
  categoryMatch: boolean;
  score: number;
  confidence: "high" | "medium" | "low";
  autoMatch: boolean;
};

type TencentResponse = {
  status?: number;
  message?: string;
  data?: Array<{
    id?: string | number;
    title?: string;
    address?: string;
    category?: string;
    location?: { lat?: number; lng?: number };
    ad_info?: { city?: string; district?: string };
  }>;
};

function normalized(value: string | null | undefined) {
  return (value || "").replace(/[\s\-—–·•（）()【】\[\]、，。,.“”'\"]/g, "").toLowerCase();
}

function dice(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const grams = (value: string) => Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2));
  const leftGrams = grams(left);
  const rightGrams = grams(right);
  if (!leftGrams.length || !rightGrams.length) return left.includes(right) || right.includes(left) ? 0.8 : 0;
  const counts = new Map<string, number>();
  leftGrams.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  let intersection = 0;
  rightGrams.forEach((item) => {
    const count = counts.get(item) || 0;
    if (count) { intersection += 1; counts.set(item, count - 1); }
  });
  return (2 * intersection) / (leftGrams.length + rightGrams.length);
}

function sameAdministrativeArea(expected: string, actual: string | null) {
  const aliases: Record<string, string> = {
    高新区: "虎丘",
    苏州高新区: "虎丘",
    虎丘区: "虎丘",
    工业园区: "苏州工业园区",
    园区: "苏州工业园区"
  };
  const canonical = (value: string | null) => {
    const compact = normalized(value);
    return normalized(aliases[compact] || compact).replace(/市$/, "").replace(/区$/, "").replace(/县$/, "");
  };
  const left = canonical(expected);
  const right = canonical(actual);
  return Boolean(left && right && (left === right || left.includes(right) || right.includes(left)));
}

function comparableBaseNames(base: { name: string; city: string; district: string }) {
  const full = normalized(base.name);
  const administrativePrefixes = [base.city, base.city.replace(/市$/, ""), base.district, `${base.city.replace(/市$/, "")}${base.district}`]
    .map(normalized)
    .filter(Boolean);
  const stripped = administrativePrefixes.reduce((value, prefix) => value.startsWith(prefix) ? value.slice(prefix.length) : value, full);
  return Array.from(new Set([full, stripped].filter(Boolean)));
}

export function scoreTencentPoi(base: { name: string; city: string; district: string; type: string }, poi: TencentPoi): TencentPoiMatch {
  const poiName = normalized(poi.name);
  const nameSimilarity = Math.max(...comparableBaseNames(base).map((sourceName) => sourceName === poiName ? 1 : Math.max(
    dice(sourceName, poiName),
    sourceName.includes(poiName) || poiName.includes(sourceName)
      ? Math.min(sourceName.length, poiName.length) / Math.max(sourceName.length, poiName.length)
      : 0
  )));
  const cityMatch = sameAdministrativeArea(base.city, poi.city);
  const districtMatch = sameAdministrativeArea(base.district, poi.district);
  const category = normalized(poi.category);
  const unreasonable = /地铁|公交|停车场|住宅|小区|酒店|餐饮|购物/.test(category);
  const categoryMatch = !unreasonable && /纪念|博物|展馆|展览|文化|旅游|景区|教育|党群|党建|楼宇|政府|社会团体|社区|公共设施|科教|会展|产业园/.test(category);
  const score = Math.min(100, Math.round(nameSimilarity * 68 + (cityMatch ? 15 : 0) + (districtMatch ? 12 : 0) + (categoryMatch ? 5 : 0)));
  const confidence = score >= 88 && nameSimilarity >= 0.86 && cityMatch && districtMatch && categoryMatch
    ? "high"
    : score >= 68 && nameSimilarity >= 0.62 && cityMatch
      ? "medium"
      : "low";
  return { nameSimilarity, cityMatch, districtMatch, categoryMatch, score, confidence, autoMatch: confidence === "high" };
}

export async function searchTencentPois(base: { name: string; city: string; district: string }) {
  const key = process.env.TENCENT_MAP_KEY;
  if (!key) throw new Error("未配置 TENCENT_MAP_KEY，无法向腾讯位置服务发起检索。");
  const query = `${base.name} ${base.city} ${base.district}`.trim();
  const params = new URLSearchParams({
    keyword: query,
    boundary: `region(${base.city},0)`,
    page_size: "5",
    page_index: "1",
    output: "json",
    key
  });
  const response = await fetch(`https://apis.map.qq.com/ws/place/v1/search?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`腾讯位置服务请求失败（HTTP ${response.status}）。`);
  const payload = await response.json() as TencentResponse;
  if (payload.status !== 0) throw new Error(payload.message || `腾讯位置服务返回异常状态 ${payload.status ?? "未知"}。`);
  return (payload.data || []).slice(0, 5).map((item): TencentPoi => ({
    poiId: item.id == null ? null : String(item.id),
    name: item.title || "未命名 POI",
    address: item.address || null,
    latitude: Number.isFinite(item.location?.lat) ? Number(item.location?.lat) : null,
    longitude: Number.isFinite(item.location?.lng) ? Number(item.location?.lng) : null,
    city: item.ad_info?.city || null,
    district: item.ad_info?.district || null,
    category: item.category || null
  }));
}
