const rawBases = require("../config/education-bases");
const locations = require("../config/education-locations");

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

const bases = rawBases.map((item) => ({
  ...item,
  location: normalizeLocation(locations[String(item.id)]),
  locationStatus: locations[String(item.id)]
    ? (locations[String(item.id)].confidence === "verified" ? "位置已核实" : "公开位置已匹配")
    : "位置待核实"
}));

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

function getMappedBases() {
  return bases.filter((item) => item.location);
}

function getMapMarkers(items = getMappedBases()) {
  return items.filter((item) => item.location).map((item) => ({
    id: Number(item.id),
    latitude: item.location.latitude,
    longitude: item.location.longitude,
    width: 32,
    height: 40,
    anchorX: 0.5,
    anchorY: 1,
    iconPath: "/assets/education-map-marker.png",
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

function searchBases({ keyword = "", type = "全部", area = "全部" } = {}) {
  const query = keyword.trim().toLowerCase();
  return bases.filter((item) => {
    const matchesType = type === "全部" || item.type === type;
    const matchesArea = area === "全部" || item.area === area;
    const haystack = [item.name, item.type, item.area, item.intro, item.status].join(" ").toLowerCase();
    return matchesType && matchesArea && (!query || haystack.includes(query));
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
  getBases,
  getTypes,
  getAreas,
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
