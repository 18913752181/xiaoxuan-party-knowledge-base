const { config, calculate } = require("../../utils/time-calculator");

const INPUT_KEY = "party_time_assistant_input_v1";
const RESULT_KEY = "party_time_assistant_result_v1";

Page({
  data: {
    result: null,
    issueCount: 0,
    resources: [],
    ruleMeta: {}
  },

  onLoad() {
    this.loadResult();
  },

  onShow() {
    if (this.data.result) this.loadResult();
  },

  loadResult() {
    const values = wx.getStorageSync(INPUT_KEY);
    if (!values || !values.applicationDate) {
      wx.showToast({ title: "请先填写日期", icon: "none" });
      setTimeout(() => wx.redirectTo({ url: "/pages/calculator/calculator" }), 500);
      return;
    }
    const result = calculate(values);
    wx.setStorageSync(RESULT_KEY, result);
    this.setData({
      result,
      issueCount: result.issues.length,
      resources: config.relatedResources,
      ruleMeta: {
        version: config.version,
        title: config.title,
        reviewedAt: config.reviewedAt
      }
    });
  },

  editDates() {
    wx.navigateBack();
  },

  openFlow() {
    wx.navigateTo({ url: "/pages/flow/flow" });
  },

  openResource(event) {
    const resource = this.data.resources.find((item) => item.id === event.currentTarget.dataset.id);
    if (!resource) return;
    const url = `${config.site.baseUrl}${resource.path}`;
    wx.navigateTo({
      url: `/pages/webview/webview?title=${encodeURIComponent(resource.title)}&url=${encodeURIComponent(url)}`
    });
  }
});
