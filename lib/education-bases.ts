import rawBases from "@/miniprogram/config/education-bases";
import rawLocations from "@/miniprogram/config/education-locations";

export type EducationBaseRow = {
  id: number;
  name: string;
  type: string;
  city: string;
  district: string;
  intro: string;
  status: string;
  icon: string;
  contact: string;
  source_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinate_type: "gcj02" | "wgs84" | null;
  location_source_name: string | null;
  location_source_url: string | null;
  location_confidence: "verified" | "probable" | "pending";
  sort_order: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
};

type LegacyBase = {
  id: number;
  name: string;
  type: string;
  area: string;
  intro?: string;
  status?: string;
  icon?: string;
  contact?: string;
  source?: string;
};

type LegacyLocation = {
  address?: string;
  latitude?: number;
  longitude?: number;
  coordinateType?: "gcj02" | "wgs84";
  sourceName?: string;
  sourceUrl?: string;
  confidence?: "verified" | "probable";
};

const SUZHOU_DISTRICTS: Record<string, string> = {
  "常熟": "常熟市",
  "高新区": "高新区",
  "姑苏": "姑苏区",
  "昆山": "昆山市",
  "太仓": "太仓市",
  "吴江": "吴江区",
  "吴中": "吴中区",
  "相城": "相城区",
  "园区": "工业园区",
  "张家港": "张家港市"
};

export const EDUCATION_BASE_SELECT = "id,name,type,city,district,intro,status,icon,contact,source_url,address,latitude,longitude,coordinate_type,location_source_name,location_source_url,location_confidence,sort_order,is_published,created_at,updated_at";

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function nullableText(value: unknown) {
  const result = text(value);
  return result || null;
}

function nullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function districtFromAddress(city: string, address?: string) {
  if (!address) return "区县待确认";
  const cityName = city.replace("市", "");
  const match = address.match(new RegExp(`${cityName}市?([^省市]{1,8}(?:区|县|市))`));
  return match ? match[1] : "区县待确认";
}

function legacyRegion(base: LegacyBase, location?: LegacyLocation) {
  if (SUZHOU_DISTRICTS[base.area]) return { city: "苏州市", district: SUZHOU_DISTRICTS[base.area] };
  const city = base.area.endsWith("市") ? base.area : `${base.area}市`;
  return { city, district: districtFromAddress(city, location?.address) };
}

export function getFallbackEducationBases(): EducationBaseRow[] {
  const locations = rawLocations as Record<string, LegacyLocation>;
  return (rawBases as LegacyBase[]).map((base, index) => {
    const location = locations[String(base.id)];
    return {
      id: base.id,
      name: base.name,
      type: base.type,
      ...legacyRegion(base, location),
      intro: base.intro || "",
      status: base.status || "可联系",
      icon: base.icon || "⌖",
      contact: base.contact || "联系信息待核实",
      source_url: base.source || null,
      address: location?.address || null,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      coordinate_type: location?.coordinateType || null,
      location_source_name: location?.sourceName || null,
      location_source_url: location?.sourceUrl || null,
      location_confidence: location?.confidence || "pending",
      sort_order: index + 1,
      is_published: true
    };
  });
}

export function normalizeEducationBaseInput(input: Record<string, unknown>, current?: EducationBaseRow) {
  const name = text(input.name, current?.name);
  const type = text(input.type, current?.type);
  const city = text(input.city, current?.city);
  const district = text(input.district, current?.district);
  if (!name || !type || !city || !district) throw new Error("名称、类型、城市和区县不能为空。");

  const latitude = nullableNumber(input.latitude ?? current?.latitude);
  const longitude = nullableNumber(input.longitude ?? current?.longitude);
  if ((latitude === null) !== (longitude === null)) throw new Error("纬度和经度需要同时填写。");
  if (latitude !== null && (latitude < -90 || latitude > 90)) throw new Error("纬度应在 -90 到 90 之间。");
  if (longitude !== null && (longitude < -180 || longitude > 180)) throw new Error("经度应在 -180 到 180 之间。");

  const coordinateValue = text(input.coordinate_type, current?.coordinate_type || "");
  const confidenceValue = text(input.location_confidence, current?.location_confidence || "pending");
  const coordinate_type = coordinateValue === "wgs84" || coordinateValue === "gcj02" ? coordinateValue : null;
  const location_confidence = confidenceValue === "verified" || confidenceValue === "probable" ? confidenceValue : "pending";

  return {
    name,
    type,
    city,
    district,
    intro: text(input.intro, current?.intro),
    status: text(input.status, current?.status || "可联系"),
    icon: text(input.icon, current?.icon || "⌖"),
    contact: text(input.contact, current?.contact || "联系信息待核实"),
    source_url: nullableText(input.source_url ?? current?.source_url),
    address: nullableText(input.address ?? current?.address),
    latitude,
    longitude,
    coordinate_type,
    location_source_name: nullableText(input.location_source_name ?? current?.location_source_name),
    location_source_url: nullableText(input.location_source_url ?? current?.location_source_url),
    location_confidence,
    sort_order: Math.max(0, Math.trunc(nullableNumber(input.sort_order ?? current?.sort_order) || 0)),
    is_published: typeof input.is_published === "boolean" ? input.is_published : current?.is_published ?? false
  };
}

export function toPublicEducationBase(row: EducationBaseRow) {
  const hasLocation = row.latitude !== null && row.longitude !== null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    city: row.city,
    district: row.district,
    intro: row.intro,
    status: row.status,
    icon: row.icon,
    contact: row.contact,
    source: row.source_url,
    location: hasLocation ? {
      address: row.address || "地址待补充",
      latitude: row.latitude,
      longitude: row.longitude,
      coordinateType: row.coordinate_type || "gcj02",
      sourceName: row.location_source_name || "后台维护",
      sourceUrl: row.location_source_url || row.source_url,
      confidence: row.location_confidence
    } : null,
    updatedAt: row.updated_at || null
  };
}
