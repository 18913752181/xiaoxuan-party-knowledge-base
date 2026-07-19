export type Category =
  | "发展党员"
  | "换届选举"
  | "三会一课"
  | "组织生活会"
  | "学习教育"
  | "支部建设";

export type Article = {
  id: string;
  title: string;
  category: Category;
  summary: string;
  updatedAt: string;
  isMemberOnly: boolean;
  body: string[];
  previewParagraphs?: number;
};

export type TemplateResource = {
  id: string;
  title: string;
  category: Category;
  fileType: "Word" | "Excel" | "PDF";
  isMemberOnly: boolean;
  updatedAt: string;
};

export const categories: Category[] = [
  "发展党员",
  "换届选举",
  "三会一课",
  "组织生活会",
  "学习教育",
  "支部建设"
];

export const hotKeywords = [
  "入党志愿书",
  "思想汇报",
  "政审",
  "换届",
  "三会一课",
  "组织生活会"
];

export const articles: Article[] = [
  {
    id: "party-application-review",
    title: "入党申请书接收后的五项基础工作",
    category: "发展党员",
    summary:
      "梳理党支部收到入党申请书后的谈话、登记、培养联系人和材料归档要点。",
    updatedAt: "2026-06-12",
    isMemberOnly: false,
    body: [
      "收到入党申请书后，党组织首先要确认申请人基本情况、申请时间和本人签名，及时做好接收登记，避免后续培养考察时间线不清。",
      "党支部一般应安排党组织负责人或指定党员同申请人谈话，了解其入党动机、政治表现、工作学习情况，并对党的基本知识进行必要提醒。",
      "后续工作要围绕培养教育展开，包括建立基础台账、明确跟踪责任、提醒申请人主动汇报思想，并将申请书、谈话记录等材料按发展党员档案要求留存。",
      "实务中最容易出问题的是时间节点前后矛盾、材料缺签字、谈话记录过于模板化。基层党务工作者应把每一步都落到可核验的记录上。"
    ]
  },
  {
    id: "branch-election-checklist",
    title: "党支部换届选举工作流程清单",
    category: "换届选举",
    summary:
      "以准备、请示、候选人酝酿、大会选举、结果报批五个阶段拆解换届工作。",
    updatedAt: "2026-06-08",
    isMemberOnly: true,
    previewParagraphs: 2,
    body: [
      "党支部换届选举应先摸清任期届满时间、党员人数、组织关系和参会条件，提前形成工作安排，确保请示报批留有充分时间。",
      "会前重点是起草换届请示、酝酿委员候选人初步人选、征求党员群众意见，并按上级党组织要求完成资格审查和会议准备。",
      "党员大会环节要严格执行到会人数、选举办法、无记名投票、差额选举、计票监票等程序要求。会议记录应准确反映主持、报告、表决和选举结果。",
      "会后应及时向上级党组织报送选举结果，完成委员分工、资料归档和新老班子工作交接。会员版提供完整 Word 清单和会议主持词模板。"
    ]
  },
  {
    id: "three-meetings-one-lesson-practice",
    title: "三会一课怎样开得规范又不空泛",
    category: "三会一课",
    summary:
      "围绕议题设计、会议记录、党员参与和结果运用，提供基层可执行建议。",
    updatedAt: "2026-05-30",
    isMemberOnly: false,
    body: [
      "三会一课的关键不在于形式复杂，而在于主题明确、程序规范、记录真实、问题闭环。每次会议都应对应支部建设或党员教育的具体任务。",
      "支委会要突出研究部署，党员大会要突出民主讨论和重大事项表决，党小组会要突出日常教育管理，党课要突出理论学习和实践结合。",
      "会议记录不宜只写笼统表述，应体现时间、地点、主持人、参会人员、主要议题、讨论意见、形成决定和后续责任。"
    ]
  },
  {
    id: "organization-life-meeting",
    title: "组织生活会会前准备材料怎么做",
    category: "组织生活会",
    summary:
      "整理学习研讨、谈心谈话、征求意见、查摆问题和发言提纲的准备思路。",
    updatedAt: "2026-05-22",
    isMemberOnly: true,
    previewParagraphs: 2,
    body: [
      "组织生活会的会前准备，通常包括集中学习、谈心谈话、征求意见、联系实际查摆问题、撰写对照检查材料或个人发言提纲。",
      "材料准备要避免只堆砌理论表述，应围绕岗位职责、党员义务、服务群众、纪律作风等方面，把具体表现、原因分析和整改措施讲清楚。",
      "谈心谈话记录要体现相互提醒和帮助，征求意见要形成归纳整理，查摆问题要能够落到整改台账。会员版提供会前准备包和个人发言提纲框架。"
    ]
  },
  {
    id: "study-education-plan",
    title: "支部年度学习教育计划的编制方法",
    category: "学习教育",
    summary:
      "从主题来源、月份安排、学习形式和成果转化四个维度搭建年度计划。",
    updatedAt: "2026-04-18",
    isMemberOnly: false,
    body: [
      "年度学习教育计划应服务支部中心工作，也要对接上级党组织年度部署。编制时可先列出必学主题，再结合业务节点安排专题学习。",
      "学习形式可以包括集中学习、专题党课、交流研讨、现场教学和个人自学，但每种形式都应有明确成果，例如心得、问题清单或改进事项。",
      "计划不宜过密，基层支部更需要可执行的节奏。建议按月设置主题，按季度复盘落实情况。"
    ]
  },
  {
    id: "branch-ledger",
    title: "基层党支部工作台账怎么建",
    category: "支部建设",
    summary:
      "用一套轻量台账覆盖组织设置、党员管理、会议活动、发展党员和整改事项。",
    updatedAt: "2026-03-28",
    isMemberOnly: true,
    previewParagraphs: 2,
    body: [
      "党支部台账的目的不是增加负担，而是让组织生活、党员管理和重点任务有迹可循。台账应尽量少而准，避免重复登记。",
      "基础台账建议覆盖党员名册、组织生活记录、党费收缴、发展党员进度、学习教育计划、问题整改清单等模块。",
      "每个模块只保留必要字段，并明确更新频率。会员版提供可编辑 Excel 台账模板和字段说明。"
    ]
  }
];

export const templates: TemplateResource[] = [
  {
    id: "application-talk-record",
    title: "入党申请人谈话记录 Word 模板",
    category: "发展党员",
    fileType: "Word",
    isMemberOnly: false,
    updatedAt: "2026-06-10"
  },
  {
    id: "branch-election-pack",
    title: "党支部换届选举全流程资料包",
    category: "换届选举",
    fileType: "Word",
    isMemberOnly: true,
    updatedAt: "2026-06-08"
  },
  {
    id: "three-meetings-record",
    title: "三会一课会议记录规范表",
    category: "三会一课",
    fileType: "Excel",
    isMemberOnly: true,
    updatedAt: "2026-05-30"
  },
  {
    id: "organization-life-checklist",
    title: "组织生活会会前准备清单",
    category: "组织生活会",
    fileType: "PDF",
    isMemberOnly: false,
    updatedAt: "2026-05-20"
  },
  {
    id: "study-plan-yearly",
    title: "支部年度学习教育计划表",
    category: "学习教育",
    fileType: "Excel",
    isMemberOnly: true,
    updatedAt: "2026-04-18"
  },
  {
    id: "branch-ledger-excel",
    title: "基层党支部工作台账 Excel 模板",
    category: "支部建设",
    fileType: "Excel",
    isMemberOnly: true,
    updatedAt: "2026-03-28"
  }
];
