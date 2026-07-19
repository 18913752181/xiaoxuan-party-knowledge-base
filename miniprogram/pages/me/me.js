const { getFavoriteMaterials, getRecentDownloads, downloadMaterial } = require("../../utils/data");

Page({
  data: {
    favorites: [],
    downloads: []
  },

  onShow() {
    this.setData({
      favorites: getFavoriteMaterials(),
      downloads: getRecentDownloads()
    });
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },

  download(event) {
    const material = this.data.favorites.concat(this.data.downloads).find((item) => item.id === event.currentTarget.dataset.id);
    downloadMaterial(material);
  }
});
