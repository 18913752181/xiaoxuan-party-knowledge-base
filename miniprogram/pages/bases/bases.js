let education;
try {
  education = require("../../utils/education");
} catch (error) {
  console.error("教育基地数据模块加载失败", error);
}
let filteredBases = [];
const PAGE_SIZE = 30;
const VIEW_MODE_KEY = "xiaoxuan_education_view_mode";

Page({
  data: {
    keyword: "",
    activeType: "全部",
    activeArea: "全部",
    types: [],
    areas: [],
    bases: [],
    markers: [],
    mappedTotal: 0,
    mappedFilteredTotal: 0,
    viewMode: "list",
    selectedBase: null,
    mapLatitude: 31.30,
    mapLongitude: 120.62,
    total: 0,
    routeCount: 0,
    loadError: "",
    hasMore: false
  },

  onLoad() {
    try {
      if (!education) throw new Error("education module unavailable");
      const savedViewMode = wx.getStorageSync(VIEW_MODE_KEY);
      this.setData({
        types: ["全部", ...education.getTypes()],
        areas: ["全部", ...education.getAreas()],
        mappedTotal: education.getMappedBases().length,
        viewMode: savedViewMode === "map" ? "map" : "list"
      }, () => this.refresh({ fitMap: this.data.viewMode === "map" }));
    } catch (error) {
      console.error("教育基地目录加载失败", error);
      this.setData({ loadError: "目录数据暂时无法加载，请稍后重试。" });
    }
  },

  onShow() {
    if (education) this.setData({ routeCount: education.getRouteIds().length });
  },

  refresh({ fitMap = false } = {}) {
    filteredBases = education.searchBases({
      keyword: this.data.keyword,
      type: this.data.activeType,
      area: this.data.activeArea
    });
    const mappedBases = filteredBases.filter((item) => item.location);
    const markers = education.getMapMarkers(mappedBases);
    this.setData({
      bases: filteredBases.slice(0, PAGE_SIZE),
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
    this.setData({ bases: filteredBases.slice(0, nextLength), hasMore: filteredBases.length > nextLength });
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

  selectArea(event) {
    clearTimeout(this.searchTimer);
    this.setData({ activeArea: event.currentTarget.dataset.value });
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
    this.setData({ keyword: "", activeType: "全部", activeArea: "全部" }, () => {
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

  onUnload() {
    clearTimeout(this.searchTimer);
  }
});
