const education = require("../../utils/education");

Page({
  data: { base: null, favorite: false, routeFull: false, inRoute: false, routeButtonText: "加入路线" },

  onLoad(options) {
    const base = education.getBaseById(options.id);
    if (!base) {
      wx.showToast({ title: "未找到该基地", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    wx.setNavigationBarTitle({ title: "基地详情" });
    this.setData({ base, favorite: education.isFavorite(base.id) });
    this.syncRouteState();
  },

  onShow() {
    if (this.data.base) this.syncRouteState();
  },

  syncRouteState() {
    const ids = education.getRouteIds();
    const inRoute = ids.includes(String(this.data.base.id));
    const routeFull = ids.length >= 3 && !inRoute;
    this.setData({
      inRoute,
      routeFull,
      routeButtonText: inRoute ? "已加入路线" : (routeFull ? "路线已满" : "加入路线")
    });
  },

  toggleFavorite() {
    const favorite = education.toggleFavorite(this.data.base.id);
    this.setData({ favorite });
    wx.showToast({ title: favorite ? "已加入收藏" : "已取消收藏", icon: "none" });
  },

  addToRoute() {
    const result = education.addRouteStop(this.data.base.id);
    if (!result.added) {
      wx.showToast({ title: result.reason === "full" ? "路线最多选择3个基地" : "已在路线清单中", icon: "none" });
      return;
    }
    this.syncRouteState();
    wx.showToast({ title: "已加入路线", icon: "success" });
  },

  openPlan() {
    wx.navigateTo({ url: "/pages/bases-plan/bases-plan" });
  },

  openLocation() {
    const { base } = this.data;
    if (!base.location) {
      wx.showToast({ title: "该点位公开位置仍待核实", icon: "none" });
      return;
    }
    wx.openLocation({
      latitude: base.location.latitude,
      longitude: base.location.longitude,
      name: base.name,
      address: base.location.address,
      scale: 17
    });
  },

  copyContact() {
    const contact = this.data.base.contact;
    if (!contact || contact === "联系信息待核实") {
      wx.showToast({ title: "该基地暂未补充联系方式", icon: "none" });
      return;
    }
    wx.setClipboardData({ data: contact, success: () => wx.showToast({ title: "联系方式已复制", icon: "none" }) });
  },

  copySource() {
    const source = this.data.base.source;
    if (!source) return;
    wx.setClipboardData({ data: source, success: () => wx.showToast({ title: "信息来源链接已复制", icon: "none" }) });
  }
});
