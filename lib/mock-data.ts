import type { DownloadRecord, Material, Profile } from "@/lib/types";

export const categories = [
  "全部",
  "发展党员",
  "三会一课",
  "第一议题",
  "中心组学习",
  "组织生活会",
  "换届选举",
  "主题党日",
  "党课课件",
  "小宣原创",
  "会员专属"
];

export const demoMaterials: Material[] = [
  {
    id: "m-001",
    title: "思想汇报怎么写",
    description: "适合发展党员材料准备的写作说明，包含结构、语气和常见注意事项。",
    category: "发展党员",
    file_type: "Word",
    file_size: "42 KB",
    updated_at: "2026-06-18",
    member_only: false,
    download_count: 128,
    favorite_count: 36,
    file_url: "/demo-files/sixianghuibao.txt"
  },
  {
    id: "m-002",
    title: "换届主持词",
    description: "基层党组织换届会议主持词模板，可按会议流程直接编辑。",
    category: "换届选举",
    file_type: "Word",
    file_size: "58 KB",
    updated_at: "2026-06-17",
    member_only: true,
    download_count: 89,
    favorite_count: 24,
    file_url: "/demo-files/huanjiezhuchici.txt"
  },
  {
    id: "m-003",
    title: "主题党日活动记录表",
    description: "用于记录主题、参会人员、活动内容和落实情况的简洁表格。",
    category: "主题党日",
    file_type: "Excel",
    file_size: "31 KB",
    updated_at: "2026-06-15",
    member_only: false,
    download_count: 203,
    favorite_count: 51,
    file_url: "/demo-files/zhutidangri.txt"
  },
  {
    id: "m-004",
    title: "第一议题学习资料汇编",
    description: "按月整理第一议题学习资料，适合支部会议前快速准备。",
    category: "第一议题",
    file_type: "PDF",
    file_size: "1.2 MB",
    updated_at: "2026-06-12",
    member_only: true,
    download_count: 76,
    favorite_count: 19,
    file_url: "/demo-files/diyiyiti.txt"
  }
];

export const demoAdmin: Profile = {
  id: "demo-admin",
  nickname: "小宣管理员",
  email: "admin@xiaoxuan.local",
  phone: "",
  member_status: "member",
  member_expires_at: "2027-12-31",
  is_admin: true
};

export function emptyDownloads(): DownloadRecord[] {
  return [];
}
