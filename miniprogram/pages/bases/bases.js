let education;
try {
  education = require("../../utils/education");
} catch (error) {
  console.error("教育基地数据模块加载失败", error);
}
let filteredBases = [];
const { withBaseVisual } = require("../../config/education-base-visuals");
const PAGE_SIZE = 30;
const VIEW_MODE_KEY = "xiaoxuan_education_view_mode";
const REMOTE_CACHE_KEY = "xiaoxuan_education_remote_bases_v1";
const EDUCATION_API_URL = "https://xiaoxuanvip.com/api/education-bases";
const FEATURED_BASE_ID = 95;
const REMOTE_SYNC_INTERVAL = 30000;

function getFeaturedBase() {
  const base = education && education.getBaseById(FEATURED_BASE_ID);
  return base ? withBaseVisual(base) : null;
}

function decorateBases(bases) {
  return bases.map(withBaseVisual);
}

Page({
  data: {
    keyword: "",
    activeType: "全部",
    activeCity: "全部城市",
    activeDistrict: "全部区县",
    types: [],
    cities: [],
    districts: [],
    bases: [],
    markers: [],
    mappedTotal: 0,
    allCount: 0,
    mappedFilteredTotal: 0,
    viewMode: "list",
    selectedBase: null,
    mapLatitude: 31.30,
    mapLongitude: 120.62,
    total: 0,
    routeCount: 0,
    favoriteCount: 0,
    featuredBase: null,
    loadError: "",
    hasMore: false
  },

  onLoad() {
    try {
      if (!education) throw new Error("education module unavailable");
      const savedViewMode = wx.getStorageSync(VIEW_MODE_KEY);
      const cachedBases = wx.getStorageSync(REMOTE_CACHE_KEY);
      if (Array.isArray(cachedBases) && cachedBases.length) education.replaceBases(cachedBases);
      this.setData({
        types: ["全部", ...education.getTypes()],
        cities: ["全部城市", ...education.getCities()],
        mappedTotal: education.getMappedBases().length,
        allCount: education.getBases().length,
        featuredBase: getFeaturedBase(),
        viewMode: savedViewMode === "map" ? "map" : "list"
      }, () => {
        this.refresh({ fitMap: this.data.viewMode === "map" });
      });
    } catch (error) {
      console.error("教育基地目录加载失败", error);
      this.setData({ loadError: "目录数据暂时无法加载，请稍后重试。" });
    }
  },

  loadRemoteBases(options = {}) {
    const fromPullDown = Boolean(options.fromPullDown);
    wx.request({
      url: `${EDUCATION_API_URL}?_=${Date.now()}`,
      method: "GET",
      header: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      },
      timeout: 10000,
      success: (response) => {
        const remoteBases = response && response.data && response.data.bases;
        if (!education.replaceBases(remoteBases)) return;
        wx.setStorageSync(REMOTE_CACHE_KEY, remoteBases);
        const activeCity = this.data.activeCity;
        const cities = ["全部城市", ...education.getCities()];
        const nextCity = cities.includes(activeCity) ? activeCity : "全部城市";
        const districts = nextCity === "全部城市" ? [] : ["全部区县", ...education.getDistricts(nextCity)];
        const nextDistrict = districts.includes(this.data.activeDistrict) ? this.data.activeDistrict : "全部区县";
        this.setData({
          types: ["全部", ...education.getTypes()],
          cities,
          districts,
          activeCity: nextCity,
          activeDistrict: nextDistrict,
          mappedTotal: education.getMappedBases().length,
          allCount: education.getBases().length,
          featuredBase: getFeaturedBase(),
          loadError: ""
        }, () => this.refresh({ fitMap: this.data.viewMode === "map" }));
      },
      fail: (error) => console.warn("教育基地后台数据读取失败，继续使用本地数据", error),
      complete: () => {
        if (fromPullDown) wx.stopPullDownRefresh();
      }
    });
  },

  onShow() {
    if (!education) return;
    this.setData({
      routeCount: education.getRouteIds().length,
      favoriteCount: education.getFavoriteIds().length
    });
    this.loadRemoteBases();
    this.startRemoteSync();
  },

  onHide() {
    this.stopRemoteSync();
  },

  startRemoteSync() {
    this.stopRemoteSync();
    this.remoteSyncTimer = setInterval(() => this.loadRemoteBases(), REMOTE_SYNC_INTERVAL);
  },

  stopRemoteSync() {
    if (!this.remoteSyncTimer) return;
    clearInterval(this.remoteSyncTimer);
    this.remoteSyncTimer = null;
  },

  onPullDownRefresh() {
    if (!education) {
      wx.stopPullDownRefresh();
      return;
    }
    this.loadRemoteBases({ fromPullDown: true });
  },

  refresh({ fitMap = false } = {}) {
    filteredBases = education.searchBases({
      keyword: this.data.keyword,
      type: this.data.activeType,
      city: this.data.activeCity,
      district: this.data.activeDistrict
    });
    const mappedBases = filteredBases.filter((item) => item.location);
    const markers = education.getMapMarkers(mappedBases);
    this.setData({
      bases: decorateBases(filteredBases.slice(0, PAGE_SIZE)),
      total: filteredBases.length,
      mappedFilteredTotal: mappedBases.length,
      markers,
      selectedBase: null,
      hasMore: filteredBases.length > PAGE_SIZE
    });
    if (fitMap && this.data.viewMode === "map" && markers.length) {
      setTimeout(() => wx.createMapContext("educationMap", this).includePoints({
        points: markers,
        padding: [52, 36, 52, 36]
      }), 80);
    }
  },

  loadMore() {
    const nextLength = this.data.bases.length + PAGE_SIZE;
    this.setData({ bases: decorateBases(filteredBases.slice(0, nextLength)), hasMore: filteredBases.length > nextLength });
  },

  inputKeyword(event) {
    this.setData({ keyword: event.detail.value });
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.refresh({ fitMap: this.data.viewMode === "map" }), 180);
  },

  clearKeyword() {
    clearTimeout(this.searchTimer);
    this.setData({ keyword: "" });
    this.refresh({ fitMap: this.data.viewMode === "map" });
  },

  selectType(event) {
    clearTimeout(this.searchTimer);
    this.setData({ activeType: event.currentTarget.dataset.value });
    this.refresh({ fitMap: this.data.viewMode === "map" });
  },

  selectCity(event) {
    clearTimeout(this.searchTimer);
    const activeCity = event.currentTarget.dataset.value;
    this.setData({
      activeCity,
      activeDistrict: "全部区县",
      districts: activeCity === "全部城市" ? [] : ["全部区县", ...education.getDistricts(activeCity)]
    }, () => this.refresh({ fitMap: this.data.viewMode === "map" }));
  },

  selectDistrict(event) {
    clearTimeout(this.searchTimer);
    this.setData({ activeDistrict: event.currentTarget.dataset.value });
    this.refresh({ fitMap: this.data.viewMode === "map" });
  },

  switchView(event) {
    clearTimeout(this.searchTimer);
    const viewMode = event.currentTarget.dataset.mode;
    if (viewMode === this.data.viewMode) return;
    wx.setStorageSync(VIEW_MODE_KEY, viewMode);
    this.setData({ viewMode, selectedBase: null }, () => {
      if (viewMode === "map") this.refresh({ fitMap: true });
    });
  },

  resetFilters() {
    clearTimeout(this.searchTimer);
    this.setData({ keyword: "", activeType: "全部", activeCity: "全部城市", activeDistrict: "全部区县", districts: [] }, () => {
      this.refresh({ fitMap: this.data.viewMode === "map" });
    });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/bases-detail/bases-detail?id=${event.currentTarget.dataset.id}` });
  },

  selectMarker(event) {
    const base = education.getBaseById(event.detail.markerId);
    if (base) this.setData({ selectedBase: base });
  },

  clearSelectedBase() {
    this.setData({ selectedBase: null });
  },

  openPlan() {
    wx.navigateTo({ url: "/pages/bases-plan/bases-plan" });
  },

  openFavorites() {
    wx.navigateTo({ url: "/pages/favorites/favorites" });
  },

  onUnload() {
    clearTimeout(this.searchTimer);
    this.stopRemoteSync();
  }
});
