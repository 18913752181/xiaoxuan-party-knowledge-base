const { getMaterialById, getMaterials, isFavorite, toggleFavorite, downloadMaterial } = require("../../utils/data");

Page({
  data: {
    material: null,
    favorite: false,
    relatedMaterials: []
  },

  onLoad(options) {
    const material = getMaterialById(options.id);
    if (!material) {
      wx.showToast({ title: "资料不存在", icon: "none" });
      return;
    }

    const relatedTitles = [].concat(material.related || [], material.recommended || []);
    const relatedMaterials = getMaterials()
      .filter((item) => item.id !== material.id && (relatedTitles.includes(item.title) || item.topic === material.topic))
      .slice(0, 4);

    this.setData({
      material,
      favorite: isFavorite(material.id),
      relatedMaterials
    });
  },

  download() {
    downloadMaterial(this.data.material);
  },

  toggleFavorite() {
    const favorite = toggleFavorite(this.data.material.id);
    this.setData({ favorite });
    wx.showToast({ title: favorite ? "已收藏" : "已取消", icon: "none" });
  },

  openRelated(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  }
});
