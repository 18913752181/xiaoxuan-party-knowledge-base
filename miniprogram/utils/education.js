const rawBases = require("../config/education-bases");
const locations = require("../config/education-locations");
const guideServices = require("../config/education-guide-services");

const PI = Math.PI;
const EARTH_A = 6378245.0;
const EE = 0.006693421622965943;

function transformLat(x, y) {
  return -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    + (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
    + (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3
    + (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
}

function transformLng(x, y) {
  return 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    + (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3
    + (20 * Math.sin(x * PI) + 40 * Math.sin(x / 3 * PI)) * 2 / 3
    + (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
}

function wgs84ToGcj02(latitude, longitude) {
  const dLat = transformLat(longitude - 105, latitude - 35);
  const dLng = transformLng(longitude - 105, latitude - 35);
  const radLat = latitude / 180 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const latitudeOffset = dLat * 180 / ((EARTH_A * (1 - EE)) / (magic * sqrtMagic) * PI);
  const longitudeOffset = dLng * 180 / (EARTH_A / sqrtMagic * Math.cos(radLat) * PI);
  return { latitude: latitude + latitudeOffset, longitude: longitude + longitudeOffset };
}

function normalizeLocation(location) {
  if (!location) return null;
  const coordinate = location.coordinateType === "wgs84"
    ? wgs84ToGcj02(location.latitude, location.longitude)
    : { latitude: location.latitude, longitude: location.longitude };
  return { ...location, ...coordinate, coordinateType: "gcj02" };
}

const SUZHOU_DISTRICTS = {
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

function districtFromAddress(city, address) {
  if (!address) return "区县待确认";
  const cityName = city.replace("市", "");
  const match = address.match(new RegExp(`${cityName}市?([^省市]{1,8}(?:区|县|市))`));
  return match ? match[1] : "区县待确认";
}

function normalizeRegion(item, location) {
  if (SUZHOU_DISTRICTS[item.area]) {
    return { city: "苏州市", district: SUZHOU_DISTRICTS[item.area] };
  }
  const city = item.area.endsWith("市") ? item.area : `${item.area}市`;
  return { city, district: districtFromAddress(city, location && location.address) };
}

function normalizeBase(item) {
  const sourceLocation = locations[String(item.id)];
  const suppliedLocation = Object.prototype.hasOwnProperty.call(item, "location") ? item.location : sourceLocation;
  const location = normalizeLocation(suppliedLocation);
  const region = item.city && item.district
    ? { city: item.city, district: item.district }
    : normalizeRegion(item, location);
  const fallbackGuide = guideServices[String(item.id)];
  const suppliedGuide = Object.prototype.hasOwnProperty.call(item, "guideService")
    ? item.guideService
    : fallbackGuide ? {
      available: fallbackGuide.hasGuidedTour,
      fee: fallbackGuide.guideFee || null,
      note: fallbackGuide.guideServiceNote || null,
      sourceUrl: fallbackGuide.guideSourceUrl || null,
      verifiedAt: fallbackGuide.guideVerifiedAt || null
    } : null;
  return {
    ...item,
    ...region,
    area: item.area || region.district,
    location,
    guideService: suppliedGuide,
    hasGuideInfo: Boolean(suppliedGuide && (suppliedGuide.available !== null || suppliedGuide.fee || suppliedGuide.note)),
    locationStatus: location
      ? (location.confidence === "verified" ? "位置已核实" : location.confidence === "probable" ? "公开位置已匹配" : "位置待核实")
      : "位置待核实"
  };
}

let bases = rawBases.map(normalizeBase);

function replaceBases(items) {
  if (!Array.isArray(items)) return false;
  bases = items.map(normalizeBase);
  return true;
}

const FAVORITE_KEY = "xiaoxuan_education_favorite_ids";
const ROUTE_KEY = "xiaoxuan_education_route_ids";

function getBases() {
  return bases.slice();
}

function getTypes() {
  return [...new Set(bases.map((item) => item.type))];
}

function getAreas() {
  return [...new Set(bases.map((item) => item.area))];
}

function getCities() {
  const preferredOrder = ["苏州市", "上海市", "无锡市", "嘉兴市"];
  const values = [...new Set(bases.map((item) => item.city))];
  return preferredOrder.filter((item) => values.includes(item)).concat(values.filter((item) => !preferredOrder.includes(item)));
}

function getDistricts(city) {
  if (!city || city === "全部城市") return [];
  return [...new Set(bases.filter((item) => item.city === city).map((item) => item.district))]
    .sort((left, right) => {
      if (left === "区县待确认") return 1;
      if (right === "区县待确认") return -1;
      return left.localeCompare(right, "zh-CN");
    });
}

function getMappedBases() {
  return bases.filter((item) => item.location);
}

function getMapMarkers(items = getMappedBases()) {
  return items.filter((item) => item.location).map((item) => ({
    id: Number(item.id),
    latitude: item.location.latitude,
    longitude: item.location.longitude,
    width: 22,
    height: 24,
    anchorX: 0.5,
    anchorY: 0.92,
    iconPath: "/assets/education-map-marker-small.png",
    callout: {
      content: item.name,
      color: "#654638",
      fontSize: 12,
      borderRadius: 10,
      bgColor: "#fffaf4",
      padding: 7,
      display: "BYCLICK"
    }
  }));
}

function getBaseById(id) {
  return bases.find((item) => String(item.id) === String(id));
}

function searchBases({ keyword = "", type = "全部", area = "全部", city = "全部城市", district = "全部区县" } = {}) {
  const query = keyword.trim().toLowerCase();
  return bases.filter((item) => {
    const matchesType = type === "全部" || item.type === type;
    const matchesArea = area === "全部" || item.area === area;
    const matchesCity = city === "全部城市" || item.city === city;
    const matchesDistrict = district === "全部区县" || item.district === district;
    const haystack = [item.name, item.type, item.area, item.city, item.district, item.intro, item.status].join(" ").toLowerCase();
    return matchesType && matchesArea && matchesCity && matchesDistrict && (!query || haystack.includes(query));
  });
}

function readIds(key) {
  const value = wx.getStorageSync(key);
  return Array.isArray(value) ? value.map(String) : [];
}

function getFavoriteIds() {
  return readIds(FAVORITE_KEY);
}

function isFavorite(id) {
  return getFavoriteIds().includes(String(id));
}

function toggleFavorite(id) {
  const value = String(id);
  const ids = getFavoriteIds();
  const index = ids.indexOf(value);
  if (index >= 0) ids.splice(index, 1);
  else ids.unshift(value);
  wx.setStorageSync(FAVORITE_KEY, ids);
  return index < 0;
}

function getFavoriteBases() {
  const ids = getFavoriteIds();
  return ids.map(getBaseById).filter(Boolean);
}

function getRouteIds() {
  return readIds(ROUTE_KEY).slice(0, 3);
}

function setRouteIds(ids) {
  const normalized = [...new Set(ids.map(String))].slice(0, 3);
  wx.setStorageSync(ROUTE_KEY, normalized);
  return normalized;
}

function addRouteStop(id) {
  const ids = getRouteIds();
  const value = String(id);
  if (ids.includes(value)) return { added: false, reason: "exists", ids };
  if (ids.length >= 3) return { added: false, reason: "full", ids };
  ids.push(value);
  setRouteIds(ids);
  return { added: true, ids };
}

module.exports = {
  replaceBases,
  getBases,
  getTypes,
  getAreas,
  getCities,
  getDistricts,
  getMappedBases,
  getMapMarkers,
  getBaseById,
  searchBases,
  getFavoriteIds,
  isFavorite,
  toggleFavorite,
  getFavoriteBases,
  getRouteIds,
  setRouteIds,
  addRouteStop
};
