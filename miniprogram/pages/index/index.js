const flow = require("../../config/development-flow");

Page({
  data: { version: flow.version },
  startCalculation() {
    wx.navigateTo({ url: "/pages/flow/flow" });
  },
  openBases() {
    wx.navigateTo({ url: "/pages/bases/bases" });
  }
});
