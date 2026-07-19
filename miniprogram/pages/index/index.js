const { getMaterials, getTopics, downloadMaterial } = require("../../utils/data");

Page({
  data: {
    keyword: "",
    hotMaterials: [],
    topics: []
  },

  onShow() {
    const materials = getMaterials();
    this.setData({
      hotMaterials: materials.slice(0, 4),
      topics: getTopics()
    });
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  search() {
    const keyword = this.data.keyword.trim();
    if (keyword) wx.setStorageSync("xiaoxuan_pending_keyword", keyword);
    wx.switchTab({ url: "/pages/materials/materials" });
  },

  openTopic(event) {
    const topic = event.currentTarget.dataset.topic;
    wx.setStorageSync("xiaoxuan_pending_topic", topic);
    wx.switchTab({ url: "/pages/materials/materials" });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  download(event) {
    const material = getMaterials().find((item) => item.id === event.currentTarget.dataset.id);
    downloadMaterial(material);
  }
});

