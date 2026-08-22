/**
 * 发展党员全流程配置
 *
 * 数据来源：用户提供的《党员发展材料目录.xlsx》（2026-08-17 读取）。
 * 维护原则：
 * 1. Excel 中的每一个序号均保留为独立节点，不在页面代码中硬编码流程内容。
 * 2. Excel 的“对应材料”未区分所需材料和形成材料，因此统一保存在 sourceMaterials；
 *    requiredMaterials / generatedMaterials 暂不擅自分类。
 * 3. timing 只配置 Excel 或用户已经明确确认的时间关系。无法换算为具体日期的条件，
 *    使用 after/manual/event 等类型提示人工确认，不擅自补充天数。
 */

const stages = [
  { id: "application", order: 1, name: "申请入党", sourceStage: "（一）申请入党阶段" },
  { id: "activist", order: 2, name: "入党积极分子", sourceStage: "（二）入党积极分子的确定和培养考察阶段" },
  { id: "development-target", order: 3, name: "发展对象", sourceStage: "（三）发展对象的确定和考察阶段" },
  { id: "probation-reception", order: 4, name: "预备党员接收", sourceStage: "（四）预备党员的接收和教育考察阶段" },
  { id: "probation-education", order: 5, name: "预备党员教育考察", sourceStage: "（四）预备党员的接收和教育考察阶段" },
  { id: "conversion", order: 6, name: "预备党员转正", sourceStage: "（五）预备党员转正阶段" },
  { id: "archive", order: 7, name: "材料归档", sourceStage: "（五）预备党员转正阶段" }
];

function node(sourceOrder, stageId, title, timeRequirement, responsibleParties, sourceMaterials, timing, extra) {
  return Object.assign({
    id: `step-${String(sourceOrder).padStart(2, "0")}`,
    sourceOrder,
    stageId,
    title,
    action: title,
    timeRequirement: timeRequirement || "资料未明确时间要求",
    prerequisite: sourceOrder === 1 ? "无前置流程节点" : "完成前序流程，并满足本节点时间要求",
    responsibleParties: responsibleParties || [],
    sourceMaterials: sourceMaterials || [],
    requiredMaterials: [],
    generatedMaterials: [],
    materialClassification: sourceMaterials && sourceMaterials.length ? "现有资料仅列出“对应材料”，未区分所需材料与形成材料" : "资料未列明材料",
    timing: timing || { type: "manual" },
    notes: []
  }, extra || {});
}

const nodes = [
  node(1, "application", "入党申请", "随时可以申请", ["本人"], ["入党申请书"], { type: "manual" }),
  node(2, "application", "党组织派人谈话（谈话人一般为书记）", "申请后一个月内", ["党支部"], ["组织谈话记录"], { type: "deadlineMonths", anchorId: "step-01", months: 1, label: "一个月内办理的截止参考日" }),

  node(3, "activist", "召开党员大会，进行党员民主推荐", "需考察满半年", ["党支部"], ["民主推荐会议记录"], { type: "offsetMonths", anchorId: "step-01", months: 6, label: "满半年最早参考日" }, { notes: ["“提交入党申请后一般考察满半年才能成为积极分子”为用户已确认规则；达到时间不代表自动进入下一阶段。"] }),
  node(4, "activist", "工会推优（35周岁以下，一般群团推优二选一）", "可在同一天", ["工会"], ["工会推优记录"], { type: "sameDay", anchorId: "step-03" }, { notes: ["35周岁以下，一般群团推优二选一。"] }),
  node(5, "activist", "共青团推优（28岁以下青年团员需要）", "可在同一天", ["团委"], ["共青团推优记录"], { type: "sameDay", anchorId: "step-03" }, { notes: ["28岁以下青年团员需要。"] }),
  node(6, "activist", "党小组集体讨论记录（若有）", "可在同一天", ["党小组"], ["党小组会议记录（如有）"], { type: "sameDay", anchorId: "step-03" }),
  node(7, "activist", "支委会确定推荐人选", "可在同一天", ["支委会"], ["支委会会议记录"], { type: "sameDay", anchorId: "step-03" }),
  node(8, "activist", "推优产生的入党积极分子名单公示", "支委会后", ["党支部"], ["入党积极分子公示"], { type: "after", anchorId: "step-07" }),
  node(9, "activist", "入党积极分子材料报上级党委备案", "公示无异议后", ["党支部"], ["入党积极分子备案报告"], { type: "after", anchorId: "step-08" }),
  node(10, "activist", "发放并填写《入党积极分子考察表》", "成为积极分子当月起填", ["党支部", "本人"], ["《入党积极分子考察表》"], { type: "sameMonth", anchorId: "step-07" }),
  node(11, "activist", "上级党委对入党积极分子进行备案登记", "收到备案报告后", ["基层党委"], ["入党积极分子备案批复"], { type: "after", anchorId: "step-09" }),
  node(12, "activist", "撰写个人自传（需手写，见模板）", "成为积极分子一个月内", ["本人"], ["个人自传"], { type: "deadlineMonths", anchorId: "step-07", months: 1, label: "一个月内完成的截止参考日" }, { notes: ["需手写，见模板。"] }),
  node(13, "activist", "每季度撰写一篇思想汇报", "成为积极分子当季度开始", ["本人"], ["思想汇报"], { type: "sameQuarter", anchorId: "step-07" }),
  node(14, "activist", "指定培养联系人，定期考察，每半年在《入党积极分子考察表》中填写考察意见（联系人、党小组组长、支部书记）", "半年考察一次", ["党支部", "培养联系人"], ["《入党积极分子考察表》"], { type: "recurringMonths", anchorId: "step-07", months: 6, label: "首次半年考察参考日" }),

  node(15, "development-target", "初步筛选确定发展人选", "成为积极分子满一年", ["党支部"], ["初步筛选"], { type: "offsetYears", anchorId: "step-07", years: 1, label: "满一年最早参考日" }, { notes: ["“积极分子考察满1年才能成为发展对象”为用户已确认规则；“初步筛选”是否属于材料待确认。"] }),
  node(16, "development-target", "确定为拟发展对象前向党小组征求意见（如有）", "可在同一天", ["党小组"], ["党小组会议记录"], { type: "sameDay", anchorId: "step-15" }, { notes: ["第16、17项在资料中合并描述；此处按两个原始序号拆分展示。"] }),
  node(17, "development-target", "召开党员群众座谈会征求意见（党员群众总人数不少于10人）", "可在同一天", ["党支部"], ["党员群众座谈会记录"], { type: "sameDay", anchorId: "step-15" }, { notes: ["第16、17项在资料中合并描述；党员群众总人数不少于10人。"] }),
  node(18, "development-target", "党支部集体讨论", "征求意见后", ["支委会"], ["支委会记录"], { type: "after", anchorId: "step-17" }),
  node(19, "development-target", "发展对象向上级党委备案", "支委会后", ["党支部"], ["发展对象备案报告", "《入党积极分子考察表》", "支部会议记录复印件", "公示"], { type: "after", anchorId: "step-18" }),
  node(20, "development-target", "发展对象备案审查意见反馈", "党委会时间", ["基层党委"], ["发展对象备案意见（盖章件）"], { type: "event", anchorId: "step-19" }),
  node(21, "development-target", "发展对象公示（五个工作日）", "支部讨论、党委通过后", ["党支部"], ["发展对象公示"], { type: "after", anchorId: "step-20", durationWorkingDays: 5 }, { notes: ["公示为五个工作日；法定节假日安排需人工核对。"] }),

  node(22, "probation-reception", "支委会确定介绍人", "发展对象备案后", ["党支部"], ["支委会记录"], { type: "after", anchorId: "step-20" }),
  node(23, "probation-reception", "发展对象政审", "集中培训前", ["党支部", "本人"], ["无犯罪记录证明", "直系亲属和主要社会关系政审证明"], { type: "before", anchorId: "step-25" }),
  node(24, "probation-reception", "党支部就政审材料形成综合材料", "集中培训前", ["党支部"], ["政审综合报告"], { type: "before", anchorId: "step-25" }),
  node(25, "probation-reception", "发展对象集中培训，获培训结业证书", "政审合格后", ["党委/党支部", "本人"], ["培训结业证书"], { type: "after", anchorId: "step-24" }),
  node(26, "probation-reception", "群众座谈会，全方位考察发展对象现实表现", "政审齐全后", ["党支部"], ["群众座谈会记录"], { type: "after", anchorId: "step-24" }),
  node(27, "probation-reception", "支委会对政审材料进行审核", "政审齐全后", ["支委会"], ["支委会记录"], { type: "after", anchorId: "step-24" }),
  node(28, "probation-reception", "预审请示", "政审齐全后", ["党支部"], ["预审请示"], { type: "after", anchorId: "step-24" }),
  node(29, "probation-reception", "预审意见", "党委会时间", ["基层党委"], ["预审意见"], { type: "event", anchorId: "step-28" }),
  node(30, "probation-reception", "支委会讨论接收拟发展对象为中共预备党员事宜，形成支委会会议记录", "收到预审意见后", ["支委会"], ["支委会记录"], { type: "after", anchorId: "step-29" }),
  node(31, "probation-reception", "发展为预备党员前公示", "支委会讨论通过后", ["党支部"], ["发展为预备党员前公示"], { type: "after", anchorId: "step-30" }),
  node(32, "probation-reception", "《入党志愿书》基本信息填写（P1-7）", "公示无异议后", ["本人", "入党介绍人", "党支部"], ["《入党志愿书》"], { type: "after", anchorId: "step-31" }),
  node(33, "probation-reception", "支部党员大会讨论接收预备党员事宜，形成支部党员大会会议记录", "正式开会讨论接收预备党员", ["党支部"], ["党员大会会议记录"], { type: "event", anchorId: "step-32" }),
  node(34, "probation-reception", "规范填写《入党志愿书》中支部大会决议", "党员大会时间", ["党支部"], ["《入党志愿书》"], { type: "sameDay", anchorId: "step-33" }),
  node(35, "probation-reception", "上级党委派人谈话并在《入党志愿书》中记录", "党员大会通过十天内", ["基层党委"], ["《入党志愿书》"], { type: "deadlineDays", anchorId: "step-33", days: 10, label: "十天内办理的截止参考日" }),
  node(36, "probation-reception", "填写《入党志愿书》党委审议意见", "党委会时间", ["基层党委"], ["《入党志愿书》"], { type: "event", anchorId: "step-35" }),
  node(37, "probation-reception", "录入党务系统", "党委审议通过后", ["基层党委"], [], { type: "after", anchorId: "step-36" }, { materialClassification: "对应材料信息为空，含义待确认" }),

  node(38, "probation-education", "编入党支部和党小组，参加组织生活，缴纳党费", "接收当月起", ["党支部"], [], { type: "sameMonth", anchorId: "step-33" }, { materialClassification: "对应材料信息为空，含义待确认" }),
  node(39, "probation-education", "入党宣誓", "建议成为预备党员一个月内", ["党委/党支部"], ["宣誓照片"], { type: "advisoryDeadlineMonths", anchorId: "step-33", months: 1, label: "建议一个月内办理的参考日" }, { notes: ["此处为“建议”表述，本系统不将其判定为强制期限。"] }),
  node(40, "probation-education", "思想汇报（每季度一篇，需手写，与《预备党员考察表》中的季度小结有所区别）", "续写", ["本人"], ["每季度思想汇报"], { type: "manual" }, { notes: ["每季度一篇，但“续写”未明确首次日期锚点，因此不生成具体日期。"] }),
  node(41, "probation-education", "培养考察（每季度一次，支部书记、入党介绍人在《预备党员考察表》中填考察意见）", "成为预备党员后第三个月起填", ["党支部"], ["《预备党员考察表》"], { type: "recurringMonths", anchorId: "step-33", months: 3, repeatMonths: 3, label: "首次季度考察参考日" }),

  node(42, "conversion", "转正申请（手写，见模板）", "预备期满前两周", ["本人"], ["转正申请"], { type: "beforeAnniversary", anchorId: "step-33", years: 1, daysBefore: 14, label: "预备期满前两周参考日" }, { notes: ["需手写，见模板。"] }),
  node(43, "conversion", "党小组讨论（如有）", "预备期满后，可在同一天", ["党小组"], ["党小组会议记录"], { type: "anniversary", anchorId: "step-33", years: 1, label: "预备期满参考日" }),
  node(44, "conversion", "听取党员群众意见（党员群众总人数不少于10人）", "预备期满后，可在同一天", ["党支部"], ["党员群众座谈会记录"], { type: "sameDay", anchorId: "step-43" }, { notes: ["党员群众总人数不少于10人。"] }),
  node(45, "conversion", "拟转正公示（五个工作日）", "预备期满后，可在同一天", ["党支部"], ["拟转正公示"], { type: "sameDay", anchorId: "step-43", durationWorkingDays: 5 }, { notes: ["公示为五个工作日；法定节假日安排需人工核对。"] }),
  node(46, "conversion", "支委会讨论关于预备党员按期转正事宜", "预备期满后，可在同一天", ["支委会"], ["支委会记录"], { type: "sameDay", anchorId: "step-43" }),
  node(47, "conversion", "支部大会讨论预备党员按期转正事宜", "公示结束后召开", ["党支部"], ["支部大会记录"], { type: "afterWorkingDays", anchorId: "step-45", workingDays: 5, label: "公示满五个工作日参考日" }, { notes: ["计算仅排除周六、周日；法定节假日和调休需人工核对，党员大会实际日期以组织安排为准。"] }),
  node(48, "conversion", "规范填写《入党志愿书》中关于预备党员按期转正的支部决议", "党员大会时间", ["党支部"], ["《入党志愿书》"], { type: "sameDay", anchorId: "step-47" }),
  node(49, "conversion", "党委召开会议进行审议，在《入党志愿书》中填写审议结果", "党委会时间", ["基层党委"], ["《入党志愿书》"], { type: "event", anchorId: "step-48" }),
  node(50, "conversion", "支部向大会公布结果", "资料未明确时间要求", ["党支部"], ["党员大会会议记录"], { type: "after", anchorId: "step-49" }),

  node(51, "archive", "材料归档", "资料未明确时间要求", ["党支部"], ["归档记录"], { type: "after", anchorId: "step-50" })
];

nodes.forEach((item, index) => {
  item.stepOrder = index + 1;
  item.previousStep = index ? nodes[index - 1].id : null;
  item.nextStep = index < nodes.length - 1 ? nodes[index + 1].id : null;
});

module.exports = {
  version: "flow-2026-08-17-v1",
  reviewedAt: "2026-08-17",
  sourceTitle: "党员发展流程资料",
  disclaimer: "时间推算仅供工作参考。达到参考日期不代表自动具备办理条件，应同时完成前置程序，并以现行党内法规和上级党组织要求为准。",
  websiteUrl: "https://xiaoxuanvip.com/materials/2026-08-10-material-1vnjh55",
  stages,
  nodes
};
