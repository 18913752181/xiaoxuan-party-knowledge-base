/**
 * 党员发展时间助手规则配置
 *
 * 维护原则：
 * 1. 页面和计算代码不写制度天数，所有可核算时间要求集中在这里。
 * 2. confirmed=true 才能参与异常判断；无法仅凭五个日期判断的要求只作提醒。
 * 3. 修改规则时同步更新 version、effectiveDate、sourceTitle、sourceUrl 和 article。
 */
module.exports = {
  version: "v1-user-confirmed-2026-08-17",
  effectiveDate: "待核对",
  reviewedAt: "2026-08-17",
  title: "第一版已确认时间规则",
  sourceUrl: "",
  disclaimer: "结果仅供工作参考，应以现行党内法规和上级党组织要求为准。系统只能核对已填写日期之间的关系，不能代替组织审查和程序审核。",

  site: {
    baseUrl: "https://xiaoxuanvip.com",
    developmentTopicPath: "/materials/2026-08-10-material-1vnjh55"
  },

  fields: [
    { key: "applicationDate", label: "递交入党申请书日期", shortLabel: "递交申请", required: true },
    { key: "activistDate", label: "确定为入党积极分子日期", shortLabel: "确定积极分子" },
    { key: "targetDate", label: "确定为发展对象日期", shortLabel: "确定发展对象" },
    { key: "probationDate", label: "党支部党员大会通过接收为预备党员日期", shortLabel: "接收预备党员" },
    { key: "fullMemberDate", label: "转为正式党员的生效日期", shortLabel: "转为正式党员" }
  ],

  rules: {
    applicationTalk: {
      id: "application-talk",
      confirmed: true,
      months: 1,
      sourceType: "user-confirmed-business-rule",
      article: "制度依据待补充",
      summary: "按已确认的第一版规则，提交入党申请后一个月内要谈话。",
      autoJudge: false,
      reason: "当前表单没有采集谈话日期，只能提示核对，不能判断是否超期。"
    },
    applicationToActivist: {
      id: "application-to-activist",
      confirmed: true,
      months: 6,
      sourceType: "confirmed-business-rule",
      article: "制度依据待补充",
      summary: "按已确认的业务规则，递交入党申请后一般考察满半年，方可确定为入党积极分子。",
      autoJudge: true,
      severity: "warning",
      reason: "该要求带有“一般”表述，未满半年时提示核对，不直接判定绝对违规。"
    },
    activistReview: {
      id: "activist-review",
      confirmed: false,
      article: "待确认",
      summary: "入党积极分子阶段的过程性考察频次待核对现行规定和上级党组织要求。",
      autoJudge: false,
      reason: "当前表单没有采集每次考察日期，只能提示核对记录。"
    },
    activistToTarget: {
      id: "activist-to-target",
      confirmed: true,
      years: 1,
      sourceType: "user-confirmed-business-rule",
      article: "制度依据待补充",
      summary: "按已确认的第一版规则，入党积极分子考察满一年才能成为发展对象。",
      autoJudge: true
    },
    targetPublicity: {
      id: "target-publicity",
      confirmed: false,
      article: "待确认",
      summary: "发展对象阶段的公示要求待核对现行规定和上级党组织要求。",
      autoJudge: false,
      reason: "当前表单没有采集公示起止日期。"
    },
    targetTraining: {
      id: "target-training",
      confirmed: false,
      article: "待确认",
      summary: "发展对象阶段的培训要求待核对现行规定和上级党组织要求。",
      autoJudge: false
    },
    precheckToMeeting: {
      id: "precheck-to-meeting",
      confirmed: false,
      article: "待确认",
      summary: "预审完成后的办理时限待核对现行规定和上级党组织要求。",
      autoJudge: false,
      reason: "当前表单没有采集党委预审合格日期。"
    },
    targetToProbation: {
      id: "target-to-probation",
      confirmed: false,
      article: "待确认",
      summary: "现行细则未规定从确定发展对象到接收为预备党员的统一最低间隔。",
      autoJudge: false
    },
    probationPeriod: {
      id: "probation-period",
      confirmed: true,
      years: 1,
      sourceType: "user-confirmed-business-rule",
      article: "制度依据待补充",
      summary: "按已确认的第一版规则，预备党员预备期为一年，按接收为预备党员日期计算周年日。",
      autoJudge: true
    },
    probationExtension: {
      id: "probation-extension",
      confirmed: false,
      article: "待确认",
      summary: "预备期延长等特殊情形待结合组织决定和现行要求核对。",
      autoJudge: false,
      reason: "是否延长须以组织决定和审批材料为准。"
    },
    oathAfterApproval: {
      id: "oath-after-approval",
      confirmed: false,
      article: "待确认",
      summary: "相关后续事项的办理要求待核对现行规定和上级党组织要求。",
      autoJudge: false,
      reason: "接收日期不等于党委批复日期，当前表单无法自动计算。"
    },
    fullMemberApproval: {
      id: "full-member-approval",
      confirmed: false,
      article: "待确认",
      summary: "转正审批等后续时限待核对现行规定和上级党组织要求。",
      autoJudge: false,
      reason: "当前表单没有采集转正决议上报日期和党委审批日期。"
    }
  },

  relatedResources: [
    { id: "topic", title: "发展党员专题资料", description: "查看指定资料页中的流程、制度依据和阶段说明", path: "/materials/2026-08-10-material-1vnjh55" },
    { id: "templates", title: "相关模板", description: "前往指定资料页查找对应阶段的表格和参考材料", path: "/materials/2026-08-10-material-1vnjh55" },
    { id: "faq", title: "常见问题", description: "前往指定资料页核对办理中容易拿不准的问题", path: "/materials/2026-08-10-material-1vnjh55" }
  ]
};
