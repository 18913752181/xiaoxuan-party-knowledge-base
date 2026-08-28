import { createClient } from "@supabase/supabase-js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rawBases = require("../miniprogram/config/education-bases.js");
const rawLocations = require("../miniprogram/config/education-locations.js");
const rawGuideServices = require("../miniprogram/config/education-guide-services.js");

const districtMap = { "常熟": "常熟市", "高新区": "高新区", "姑苏": "姑苏区", "昆山": "昆山市", "太仓": "太仓市", "吴江": "吴江区", "吴中": "吴中区", "相城": "相城区", "园区": "工业园区", "张家港": "张家港市" };
function region(base, location) {
  if (districtMap[base.area]) return { city: "苏州市", district: districtMap[base.area] };
  const city = base.area.endsWith("市") ? base.area : `${base.area}市`;
  const cityName = city.replace("市", "");
  const match = location?.address?.match(new RegExp(`${cityName}市?([^省市]{1,8}(?:区|县|市))`));
  return { city, district: match ? match[1] : "区县待确认" };
}

const rows = rawBases.map((base, index) => {
  const location = rawLocations[String(base.id)];
  const guide = rawGuideServices[String(base.id)];
  return {
    id: base.id,
    name: base.name,
    type: base.type,
    ...region(base, location),
    intro: base.intro || "",
    status: base.status || "可联系",
    icon: base.icon || "⌖",
    contact: base.contact || "联系信息待核实",
    source_url: base.source || null,
    has_guided_tour: guide?.hasGuidedTour ?? null,
    guide_fee: guide?.guideFee || null,
    guide_service_note: guide?.guideServiceNote || null,
    guide_source_url: guide?.guideSourceUrl || null,
    guide_verified_at: guide?.guideVerifiedAt || null,
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

if (process.argv.includes("--dry-run")) {
  const located = rows.filter((item) => item.latitude !== null && item.longitude !== null).length;
  console.log(`待导入 ${rows.length} 条教育基地，其中 ${located} 条已有坐标。`);
  process.exit(0);
}

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await supabase.from("education_bases").upsert(rows, { onConflict: "id" });
if (error) throw error;
console.log(`已写入 ${rows.length} 条教育基地。`);
