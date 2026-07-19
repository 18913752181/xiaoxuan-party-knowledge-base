const { getTopics, searchMaterials, downloadMaterial } = require("../../utils/data");

Page({
  data: {
    keyword: "",
    currentTopic: "",
    topics: [],
    materials: []
  },

  onShow() {
    const pendingTopic = wx.getStorageSync("xiaoxuan_pending_topic") || "";
    const pendingKeyword = wx.getStorageSync("xiaoxuan_pending_keyword") || "";
    wx.removeStorageSync("xiaoxuan_pending_topic");
    wx.removeStorageSync("xiaoxuan_pending_keyword");

    this.setData({
      topics: getTopics(),
      currentTopic: pendingTopic || this.data.currentTopic,
      keyword: pendingKeyword || this.data.keyword
    });
    this.refresh();
  },

  refresh() {
    this.setData({
      materials: searchMaterials({ keyword: this.data.keyword, topic: this.data.currentTopic })
    });
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.refresh());
  },

  clearTopic() {
    this.setData({ currentTopic: "" }, () => this.refresh());
  },

  selectTopic(event) {
    this.setData({ currentTopic: event.currentTarget.dataset.topic }, () => this.refresh());
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  download(event) {
    const material = this.data.materials.find((item) => item.id === event.currentTarget.dataset.id);
    downloadMaterial(material);
  }
});
