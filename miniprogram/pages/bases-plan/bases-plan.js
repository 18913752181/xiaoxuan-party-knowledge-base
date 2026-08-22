const education = require("../../utils/education");

Page({
  data: { stops: [], allBases: [], routeCount: 0 },

  onLoad() {
    this.setData({ allBases: education.getBases() });
    this.refresh();
  },

  onShow() { this.refresh(); },

  refresh() {
    const ids = education.getRouteIds();
    const stops = ids.map(education.getBaseById).filter(Boolean);
    this.setData({ stops, routeCount: stops.length });
  },

  chooseStop(event) {
    const position = Number(event.currentTarget.dataset.position);
    const id = this.data.allBases[Number(event.detail.value)].id;
    const ids = education.getRouteIds();
    ids[position] = String(id);
    education.setRouteIds(ids);
    this.refresh();
  },

  removeStop(event) {
    const ids = education.getRouteIds();
    ids.splice(Number(event.currentTarget.dataset.position), 1);
    education.setRouteIds(ids);
    this.refresh();
  },

  openBases() {
    wx.navigateBack({ fail: () => wx.redirectTo({ url: "/pages/bases/bases" }) });
  },

  clearRoute() {
    if (!this.data.stops.length) return;
    wx.showModal({ title: "清空路线", content: "确定清空当前路线清单吗？", success: (res) => { if (res.confirm) { education.setRouteIds([]); this.refresh(); } } });
  }
});
