export type WorkTopic = {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  scenario: string;
  steps: string[];
  checklist: string[];
  requirements: string[];
  legalBasis: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const workTopics: WorkTopic[] = [
  {
    slug: "development-members",
    name: "发展党员",
    aliases: ["发展党员", "入党", "积极分子", "预备党员"],
    summary: "把申请入党、培养考察、接收预备党员和转正各环节衔接清楚。",
    scenario: "适用于党支部开展入党申请人培养、积极分子确定、发展对象审查、预备党员接收和转正工作。",
    steps: ["递交申请", "培养联系", "确定积极分子", "确定发展对象", "政治审查与培训", "接收预备党员", "教育考察", "转正"],
    checklist: ["核对申请材料", "确定培养联系人", "按期填写培养考察意见", "履行支委会和党员大会程序", "完成公示和上级审批", "整理发展党员档案"],
    requirements: ["坚持政治标准", "严格履行程序", "逐人逐项审核材料", "关键节点留痕归档"],
    legalBasis: ["《中国共产党章程》", "《中国共产党发展党员工作细则》"],
    faqs: [{ question: "培养考察时间如何计算？", answer: "应结合确定为入党积极分子、发展对象和预备党员等具体节点，按规定持续培养考察并如实记录。" }]
  },
  {
    slug: "three-meetings-one-lesson",
    name: "三会一课",
    aliases: ["三会一课", "党员大会", "支委会", "党小组会", "党课"],
    summary: "按频次、议题和记录要求规范召开党员大会、支委会、党小组会和党课。",
    scenario: "适用于党支部制定年度组织生活计划、安排会议议题、规范记录和检查落实情况。",
    steps: ["制定计划", "确定议题", "会前通知", "组织召开", "形成记录", "跟踪落实"],
    checklist: ["明确年度安排", "核对召开频次", "准备议题和材料", "做好签到与记录", "落实会议决定", "整理归档"],
    requirements: ["突出政治学习和议事决策", "防止会议内容同质化", "记录应完整准确", "决定事项要有后续落实"],
    legalBasis: ["《中国共产党支部工作条例（试行）》", "《关于新形势下党内政治生活的若干准则》"],
    faqs: [{ question: "党员大会多久召开一次？", answer: "一般每季度召开1次，工作需要时可随时召开；具体还应结合上级要求和支部实际。" }]
  },
  {
    slug: "first-agenda-item",
    name: "第一议题",
    aliases: ["第一议题", "理论学习", "学习贯彻"],
    summary: "围绕及时学习、研究贯彻和跟踪落实，形成完整工作闭环。",
    scenario: "适用于党组织会议安排重要理论学习内容，并结合实际研究贯彻落实措施。",
    steps: ["确定学习内容", "准备学习材料", "组织学习研讨", "研究贯彻措施", "形成落实清单", "跟踪问效"],
    checklist: ["确认学习主题", "准备权威材料", "安排领学或研讨", "联系实际研究落实", "记录具体措施", "跟踪办理结果"],
    requirements: ["及时跟进学习", "坚持联系实际", "避免只学不议", "落实情况可跟踪"],
    legalBasis: ["上级党组织关于理论学习和‘第一议题’制度的有关规定"],
    faqs: [{ question: "第一议题只需要学习原文吗？", answer: "除学习重要内容外，还应结合本单位实际研究贯彻措施，形成可落实、可检查的安排。" }]
  },
  {
    slug: "organizational-life-meeting",
    name: "组织生活会",
    aliases: ["组织生活会", "谈心谈话", "查摆问题", "整改清单"],
    summary: "从会前准备、查摆问题到民主评议和整改落实，按步骤完成整套工作。",
    scenario: "适用于党支部召开年度或专题组织生活会，并同步开展民主评议党员。",
    steps: ["确定时间", "制定方案", "集中学习", "征求意见", "谈心谈话", "查摆问题", "召开会议", "民主评议", "整改归档"],
    checklist: ["确定时间", "制定方案", "开展集中学习", "征求意见", "谈心谈话", "查摆问题", "召开会议", "民主评议党员", "形成整改清单", "整理归档材料"],
    requirements: ["会前准备充分", "谈心谈话到位", "批评和自我批评具体", "整改措施可执行可检查"],
    legalBasis: ["《关于新形势下党内政治生活的若干准则》", "《中国共产党支部工作条例（试行）》", "上级党组织年度工作通知"],
    faqs: [{ question: "组织生活会一般什么时候召开？", answer: "通常根据上级党组织年度安排集中组织，具体时间和主题以当年通知要求为准。" }]
  },
  {
    slug: "democratic-evaluation",
    name: "民主评议党员",
    aliases: ["民主评议党员", "民主评议", "党员评议"],
    summary: "规范个人自评、党员互评、民主测评和组织评定，准确形成评议结果。",
    scenario: "适用于党支部结合组织生活会或按上级部署开展年度民主评议党员。",
    steps: ["学习动员", "个人自评", "党员互评", "民主测评", "组织评定", "结果反馈"],
    checklist: ["明确参评范围", "准备测评表", "组织个人自评", "开展党员互评", "汇总测评结果", "支委会研究评定", "反馈并归档"],
    requirements: ["客观公正", "程序规范", "结果有依据", "稳妥做好结果反馈"],
    legalBasis: ["《中国共产党支部工作条例（试行）》", "上级党组织民主评议党员工作通知"],
    faqs: [{ question: "预备党员能否参加民主评议？", answer: "预备党员一般参加民主评议，但不评定等次；具体按当年上级通知执行。" }]
  },
  {
    slug: "theme-party-day",
    name: "主题党日",
    aliases: ["主题党日", "党日活动"],
    summary: "围绕鲜明主题安排学习、议事和实践活动，避免形式化和娱乐化。",
    scenario: "适用于党支部按月策划和组织主题党日，形成活动方案、过程记录和成效总结。",
    steps: ["确定主题", "制定方案", "发布通知", "组织实施", "记录过程", "总结归档"],
    checklist: ["结合重点任务选题", "明确时间地点人员", "准备学习和活动材料", "组织签到", "做好图文记录", "形成简要总结"],
    requirements: ["突出政治性", "主题具体鲜明", "内容联系实际", "活动过程完整留痕"],
    legalBasis: ["《中国共产党支部工作条例（试行）》", "上级党组织主题党日有关制度"],
    faqs: [{ question: "主题党日可以只开展参观活动吗？", answer: "应突出政治功能和组织生活属性，参观实践可作为载体，但需有明确主题和学习、交流或落实环节。" }]
  },
  {
    slug: "branch-election",
    name: "换届选举",
    aliases: ["换届选举", "支部换届", "选举", "候选人"],
    summary: "从请示报批、候选人酝酿到大会选举和结果报告，逐项核对程序材料。",
    scenario: "适用于基层党组织任期届满换届、委员补选及相关请示报批工作。",
    steps: ["启动请示", "人选酝酿", "上级批复", "筹备会议", "大会选举", "结果报告", "材料归档"],
    checklist: ["核对任期和启动时间", "报送换届请示", "酝酿候选人", "准备选举办法和选票", "组织党员大会", "报告选举结果", "完成新旧班子交接"],
    requirements: ["严格执行任期制度", "充分发扬党内民主", "候选人和选举程序合规", "请示批复材料齐全"],
    legalBasis: ["《中国共产党基层组织选举工作条例》", "《中国共产党支部工作条例（试行）》"],
    faqs: [{ question: "党支部换届需要哪些材料？", answer: "通常包括换届请示、候选人有关材料、批复、会议议程、选举办法、选票、主持词、计票结果和选举结果报告等。" }]
  },
  {
    slug: "party-member-training",
    name: "党员教育培训",
    aliases: ["党员教育培训", "党员培训", "培训班"],
    summary: "从年度计划、课程安排到组织实施和培训归档，形成规范闭环。",
    scenario: "适用于党组织制定党员教育培训计划、举办集中培训班或开展专题培训。",
    steps: ["需求分析", "制定计划", "课程设计", "组织报名", "实施培训", "考核总结", "资料归档"],
    checklist: ["明确培训对象", "制定实施方案", "安排课程和师资", "发送培训通知", "准备签到和学员手册", "组织考核", "形成培训总结"],
    requirements: ["突出政治教育", "分类设置课程", "加强学风管理", "培训记录真实完整"],
    legalBasis: ["《中国共产党党员教育管理工作条例》", "党员教育培训工作规划及年度安排"],
    faqs: [{ question: "党员培训资料应保留哪些？", answer: "建议保留方案、通知、课程表、签到表、讲义、过程记录、考核材料和培训总结等。" }]
  }
];

export const annualWorkPlan = [
  { month: 1, items: ["制定年度党建工作计划", "梳理党员教育培训安排", "研究主题党日计划"] },
  { month: 2, items: ["开展集中学习", "更新党员信息台账", "部署年度组织生活"] },
  { month: 3, items: ["组织生活会", "民主评议党员", "形成整改清单"] },
  { month: 4, items: ["第一议题学习", "入党积极分子培养考察", "主题党日"] },
  { month: 5, items: ["党员教育培训", "谈心谈话", "党费收缴检查"] },
  { month: 6, items: ["专题党课", "发展党员材料审核", "半年工作回顾"] },
  { month: 7, items: ["庆祝建党主题活动", "党员教育培训", "主题党日"] },
  { month: 8, items: ["支部工作自查", "党员档案检查", "第一议题学习"] },
  { month: 9, items: ["三会一课计划复盘", "发展对象培养", "主题党日"] },
  { month: 10, items: ["年度重点任务检查", "换届准备", "党员培训"] },
  { month: 11, items: ["年度总结准备", "党组织书记述职评议考核", "明年工作建议"] },
  { month: 12, items: ["年度党建工作总结", "支部资料归档", "制定下一年度计划"] }
];

export const workTools = [
  { name: "工作清单", type: "工作清单", description: "按步骤核对关键事项，避免遗漏程序。" },
  { name: "流程图", type: "工作流程", description: "先看完整路径，再进入具体办理环节。" },
  { name: "制度依据", type: "制度依据", description: "快速找到对应条例、细则和工作要求。" },
  { name: "填写示例", type: "填写示例", description: "了解常用表格和材料应如何填写。" },
  { name: "Word模板", type: "模板资料", description: "下载后直接编辑，减少重复排版。" },
  { name: "Excel台账", type: "模板资料", description: "用于记录、统计和日常工作管理。" }
];

export const commonQuestions = [
  "党员大会多久召开一次？",
  "支委会每月必须召开吗？",
  "组织生活会一般什么时候召开？",
  "预备党员能否参加民主评议？",
  "党支部换届需要哪些材料？"
];

export function getWorkTopic(slugOrName: string) {
  const value = decodeURIComponent(slugOrName);
  return workTopics.find((topic) => topic.slug === value || topic.name === value || topic.aliases.includes(value));
}

export function findWorkTopics(query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return workTopics;
  return workTopics.filter((topic) =>
    [topic.name, topic.summary, topic.scenario, ...topic.aliases, ...topic.steps, ...topic.checklist, ...topic.legalBasis, ...topic.faqs.map((item) => item.question)]
      .join(" ")
      .toLowerCase()
      .includes(keyword)
  );
}
