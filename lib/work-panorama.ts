import type { Material } from "@/lib/types";

export type WorkSection = {
  name: string;
  items?: string[];
  keywords?: string[];
};

export type WorkLevel = {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  sections: WorkSection[];
};

export const defaultWorkLevels: WorkLevel[] = [
  {
    slug: "party-committee",
    name: "党委工作",
    shortDescription: "把方向、管大局、保落实",
    description: "围绕党的领导、政治建设和全面从严治党，统筹推进本单位党的建设。",
    sections: [
      { name: "党的领导与政治建设", keywords: ["党的领导", "政治建设", "第一议题"] },
      { name: "理论学习与思想建设", keywords: ["理论学习", "思想建设", "中心组", "党员教育"] },
      { name: "组织建设与干部人才", keywords: ["组织建设", "干部", "人才", "换届", "发展党员"] },
      { name: "全面从严治党", keywords: ["全面从严治党", "党风廉政", "纪律", "民主生活会"] },
      { name: "引领中心工作", keywords: ["引领中心工作", "中心工作", "联建共建", "为群众办实事"] },
    ],
  },
  {
    slug: "general-party-branch",
    name: "党总支工作",
    shortDescription: "承上启下、统筹协调",
    description: "突出承上启下、统筹协调、指导支部、督促落实，推动上级部署落到所属党支部。",
    sections: [
      { name: "贯彻落实上级党组织部署", keywords: ["上级党组织", "贯彻落实", "部署"] },
      { name: "研究部署本单位工作", keywords: ["工作计划", "工作总结", "重点工作"] },
      { name: "指导所属党支部建设", keywords: ["支部建设", "换届", "支委"] },
      { name: "党员教育管理", keywords: ["党员教育", "党员培训", "党员管理"] },
      { name: "组织生活与主题活动", keywords: ["组织生活", "主题党日", "三会一课"] },
      { name: "检查考核与工作报告", keywords: ["检查", "考核", "述职", "工作报告"] },
    ],
  },
  {
    slug: "party-branch",
    name: "党支部工作",
    shortDescription: "把规定动作做清楚",
    description: "从支部日常工作出发，按板块和事项查找制度、材料与模板。",
    sections: [
      { name: "支部建设", items: ["支部换届", "支委分工", "工作计划", "工作总结"], keywords: ["支部建设", "换届选举"] },
      {
        name: "组织生活",
        items: ["党员大会", "支委会", "党小组会", "党课", "主题党日", "组织生活会", "民主评议党员", "谈心谈话"],
        keywords: ["组织生活", "三会一课", "主题党日"],
      },
      {
        name: "党员队伍",
        items: ["发展党员", "党员教育", "组织关系", "流动党员管理", "党籍党龄", "关怀帮扶"],
        keywords: ["发展党员", "党员培训", "党员教育"],
      },
      { name: "作用发挥", items: ["志愿服务", "联建共建", "为群众办实事"], keywords: ["作用发挥", "志愿服务", "联建共建"] },
      { name: "基础保障", items: ["党费管理", "阵地建设", "会议记录", "档案归档"], keywords: ["基础保障", "党费", "阵地", "会议记录", "档案"] },
    ],
  },
];

export function materialSearchText(material: Material) {
  return [
    material.title,
    material.description,
    material.summary,
    material.topic,
    material.category,
    material.stage,
    ...(material.tags || []),
    ...(material.organizationLevels || []),
    ...(material.workSections || []),
    ...(material.workItems || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesWorkLevel(material: Material, level: WorkLevel) {
  if (material.organizationLevels?.includes(level.name)) return true;
  if (level.slug !== "party-branch") return level.sections.some((section) => matchesWorkSection(material, level, section));
  return level.sections.some((section) => matchesWorkSection(material, level, section));
}

export function matchesWorkSection(material: Material, level: WorkLevel, section: WorkSection) {
  if (material.organizationLevels?.includes(level.name) && material.workSections?.includes(section.name)) return true;
  if (material.workSections?.includes(section.name)) return true;
  const text = materialSearchText(material);
  return [...(section.keywords || []), ...(section.items || [])].some((keyword) => text.includes(keyword.toLowerCase()));
}

export function matchesWorkItem(material: Material, item: string) {
  if (material.workItems?.includes(item)) return true;
  const aliases: Record<string, string[]> = {
    支部换届: ["支部换届", "换届选举"],
    党员教育: ["党员教育", "党员培训"],
    党课: ["党课", "三会一课"],
  };
  const text = materialSearchText(material);
  return (aliases[item] || [item]).some((keyword) => text.includes(keyword.toLowerCase()));
}
