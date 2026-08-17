const rules = require("../../config/time-rules");

Page({
  data: { version: rules.version },
  startCalculation() {
    wx.navigateTo({ url: "/pages/calculator/calculator" });
  },
  openFlow() {
    wx.navigateTo({ url: "/pages/flow/flow" });
  }
});
