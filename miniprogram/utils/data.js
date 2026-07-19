const materials = require("../data/materials.json");

const FAVORITE_KEY = "xiaoxuan_favorite_ids";
const RECENT_DOWNLOAD_KEY = "xiaoxuan_recent_downloads";

function getMaterials() {
  return materials || [];
}

function getMaterialById(id) {
  return getMaterials().find((item) => item.id === id || item.slug === id) || null;
}

function getTopics() {
  const preferred = ["发展党员", "换届选举", "三会一课", "主题党日", "民主生活会", "第一议题", "中心组学习"];
  const existing = Array.from(new Set(getMaterials().map((item) => item.topic).filter(Boolean)));
  return preferred.filter((topic) => existing.includes(topic)).concat(existing.filter((topic) => !preferred.includes(topic)));
}

function searchMaterials(options = {}) {
  const keyword = String(options.keyword || "").trim().toLowerCase();
  const topic = String(options.topic || "").trim();

  return getMaterials().filter((item) => {
    const matchTopic = !topic || item.topic === topic;
    const text = [item.title, item.description, item.topic, item.stage, item.fileType, ...(item.tags || [])]
      .join(" ")
      .toLowerCase();
    const matchKeyword = !keyword || text.includes(keyword);
    return matchTopic && matchKeyword;
  });
}

function getFavoriteIds() {
  return wx.getStorageSync(FAVORITE_KEY) || [];
}

function isFavorite(id) {
  return getFavoriteIds().includes(id);
}

function toggleFavorite(id) {
  const ids = getFavoriteIds();
  const next = ids.includes(id) ? ids.filter((item) => item !== id) : [id].concat(ids);
  wx.setStorageSync(FAVORITE_KEY, next);
  return next.includes(id);
}

function getFavoriteMaterials() {
  const ids = getFavoriteIds();
  return ids.map(getMaterialById).filter(Boolean);
}

function addRecentDownload(id) {
  const ids = wx.getStorageSync(RECENT_DOWNLOAD_KEY) || [];
  const next = [id].concat(ids.filter((item) => item !== id)).slice(0, 20);
  wx.setStorageSync(RECENT_DOWNLOAD_KEY, next);
}

function getRecentDownloads() {
  const ids = wx.getStorageSync(RECENT_DOWNLOAD_KEY) || [];
  return ids.map(getMaterialById).filter(Boolean);
}

function downloadMaterial(material) {
  if (!material || !material.downloadUrl) {
    wx.showToast({ title: "暂无文件", icon: "none" });
    return;
  }

  wx.showLoading({ title: "正在下载" });
  wx.downloadFile({
    url: material.downloadUrl,
    success(result) {
      if (result.statusCode !== 200) {
        wx.showToast({ title: "下载失败", icon: "none" });
        return;
      }
      addRecentDownload(material.id);
      wx.openDocument({
        filePath: result.tempFilePath,
        showMenu: true,
        fail() {
          wx.showToast({ title: "文件已下载", icon: "success" });
        }
      });
    },
    fail(error) {
      console.error(error);
      wx.showToast({ title: "请检查下载域名配置", icon: "none" });
    },
    complete() {
      wx.hideLoading();
    }
  });
}

module.exports = {
  getMaterials,
  getMaterialById,
  getTopics,
  searchMaterials,
  isFavorite,
  toggleFavorite,
  getFavoriteMaterials,
  getRecentDownloads,
  downloadMaterial
};
