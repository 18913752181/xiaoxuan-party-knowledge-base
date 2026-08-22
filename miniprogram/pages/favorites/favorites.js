const education = require("../../utils/education");

Page({
  data: { bases: [] },
  onShow() { this.setData({ bases: education.getFavoriteBases() }); },
  openDetail(event) { wx.navigateTo({ url: `/pages/bases-detail/bases-detail?id=${event.currentTarget.dataset.id}` }); },
  openBases() { wx.reLaunch({ url: "/pages/bases/bases" }); }
});
