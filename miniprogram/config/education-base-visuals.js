const VISUALS = {
  "14": {
    featureImage: "/assets/education-bases/base-14-suzhou-independent-branch-cover.jpg",
    coverImageUrl: "/assets/education-bases/base-14-suzhou-independent-branch-cover.jpg",
    thumbnailImageUrl: "/assets/education-bases/base-14-suzhou-independent-branch-thumb.jpg",
    imageKind: "postcard-motif",
    imageAlt: "中共苏州独立支部旧址建筑插画",
    imageSourceName: "苏州市地方志编纂委员会办公室（照片选自《苏州年鉴2023》）",
    imageSourceUrl: "https://dfzb.suzhou.gov.cn/dfzb/szdq/202407/e6402ccd3ebf482a8c372e12d657a341.shtml",
    imageRightsStatus: "reference-only",
    imageVerifiedAt: "2026-09-06",
    postcardMasterFile: "base-14-suzhou-independent-branch-postcard.png",
    motifCrop: { x: 475, y: 1104, width: 549, height: 365 }
  },
  "30": {
    featureImage: "/assets/education-bases/base-30-suzhou-planning-exhibition-cover.jpg",
    coverImageUrl: "/assets/education-bases/base-30-suzhou-planning-exhibition-cover.jpg",
    thumbnailImageUrl: "/assets/education-bases/base-30-suzhou-planning-exhibition-thumb.jpg",
    imageKind: "postcard-motif",
    imageAlt: "苏州市规划展示馆建筑插画",
    imageSourceName: "苏州市规划展示馆场馆公开资料页（云馆）",
    imageSourceUrl: "https://yunghzg.cn/default.aspx/?RoomID=41",
    imageRightsStatus: "reference-only",
    imageVerifiedAt: "2026-09-06",
    postcardMasterFile: "base-30-suzhou-planning-exhibition-postcard.png",
    motifCrop: { x: 300, y: 1090, width: 724, height: 425 }
  },
  "95": {
    featureImage: "/assets/education-bases/taihu-guerrilla-memorial-illustration-hd.jpg"
  },
  "113": {
    featureImage: "/assets/education-bases/park-experience-motif.jpg"
  }
};

function withBaseVisual(base) {
  if (!base) return base;
  const visual = VISUALS[String(base.id)];
  return visual ? Object.assign({}, visual, base) : base;
}

module.exports = {
  VISUALS,
  withBaseVisual
};
