Page({
  data: { url: "", invalid: false },

  onLoad(options) {
    const title = decodeURIComponent(options.title || "相关资料");
    const url = decodeURIComponent(options.url || "");
    wx.setNavigationBarTitle({ title });
    if (!/^https:\/\/(www\.)?xiaoxuanvip\.com(?:\/|$)/.test(url)) {
      this.setData({ invalid: true });
      return;
    }
    this.setData({ url });
  }
});
