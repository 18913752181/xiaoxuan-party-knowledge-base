const education = require("../../utils/education");
const { withBaseVisual } = require("../../config/education-base-visuals");
const GUIDE_API = "https://xiaoxuanvip.com/api/miniprogram/education-base-guide";

function loadGuide(baseId) {
  return new Promise((resolve, reject) => wx.login({
    success(loginResult) {
      if (!loginResult.code) return reject(new Error("微信登录失败"));
      wx.request({
        url: `${GUIDE_API}?id=${encodeURIComponent(baseId)}&_=${Date.now()}`,
        method: "GET",
        header: { "X-WX-Code": loginResult.code, "Cache-Control": "no-cache" },
        timeout: 10000,
        success(response) {
          if (response.statusCode >= 200 && response.statusCode < 300) return resolve(response.data || {});
          reject(new Error((response.data && response.data.error) || "攻略读取失败"));
        },
        fail: reject
      });
    },
    fail: reject
  }));
}

Page({
  data: {
    base: null, favorite: false, routeFull: false, inRoute: false, routeButtonText: "加入路线",
    guideLoading: true, guideError: "", memberBound: false, memberActive: false,
    memberGuide: null,
    guidePreview: ["经核实的联系与预约信息", "开放与讲解服务", "适合开展的活动形式和人群", "活动路线与周边基地组合", "活动方案及相关资料"]
  },

  onLoad(options) {
    const base = education.getBaseById(options.id);
    if (!base) {
      wx.showToast({ title: "未找到该基地", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    wx.setNavigationBarTitle({ title: "基地详情" });
    const visualBase = withBaseVisual(base);
    this.setData({ base: visualBase, favorite: education.isFavorite(base.id) });
    this.syncRouteState();
    this.loadMemberGuide();
  },

  onShow() {
    if (!this.data.base) return;
    this.syncRouteState();
    if (this._initialShowComplete) this.loadMemberGuide();
    this._initialShowComplete = true;
  },

  async loadMemberGuide() {
    if (!this.data.base || this._guideRequestRunning) return;
    this._guideRequestRunning = true;
    this.setData({ guideLoading: true, guideError: "" });
    try {
      const payload = await loadGuide(this.data.base.id);
      this.setData({
        memberBound: Boolean(payload.bound),
        memberActive: Boolean(payload.active),
        memberGuide: payload.active && payload.guide ? payload.guide : null,
        guidePreview: Array.isArray(payload.preview) && payload.preview.length ? payload.preview : this.data.guidePreview
      });
    } catch (error) {
      this.setData({ guideError: error.message || "基地攻略暂时无法读取" });
    } finally {
      this._guideRequestRunning = false;
      this.setData({ guideLoading: false });
    }
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

  copyGuideValue(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) return wx.showToast({ title: "该项资料待完善", icon: "none" });
    wx.setClipboardData({ data: value, success: () => wx.showToast({ title: "内容已复制", icon: "none" }) });
  },

  openMembership() {
    const url = encodeURIComponent("https://xiaoxuanvip.com/membership/payment");
    const title = encodeURIComponent("解锁基地攻略");
    wx.navigateTo({ url: `/pages/webview/webview?title=${title}&url=${url}` });
  },

  openMemberBinding() {
    wx.navigateTo({ url: "/pages/dashboard/dashboard" });
  }
});
