const { flow, calculateTimeline, formatDate } = require("../../utils/development-flow-calculator");

function statusLabel(status) {
  const labels = {
    known: "已知日期",
    earliest: "最早参考",
    deadline: "截止参考",
    advisory: "建议时间",
    condition: "条件参考",
    reference: "办理参考",
    pending: "待确认",
    before: "此前节点"
  };
  return labels[status] || "办理参考";
}

function stageNodes(stageId, resultMap, selectedOrder) {
  return flow.nodes.filter((item) => item.stageId === stageId).map((item) => {
    let schedule = resultMap[item.id];
    if (!schedule && selectedOrder && item.sourceOrder < selectedOrder) {
      schedule = { status: "before", dateText: "—", summary: "位于本次输入节点之前，不参与向后推算" };
    }
    if (schedule) schedule = Object.assign({}, schedule, { statusLabel: statusLabel(schedule.status) });
    return Object.assign({}, item, {
      orderText: String(item.sourceOrder).padStart(2, "0"),
      partyText: item.responsibleParties.join("、"),
      materialCount: item.sourceMaterials.length,
      schedule
    });
  });
}

Page({
  data: {
    sourceVersion: flow.version,
    sourceTitle: flow.sourceTitle,
    disclaimer: flow.disclaimer,
    stages: flow.stages.map((stage) => Object.assign({}, stage, {
      count: flow.nodes.filter((node) => node.stageId === stage.id).length,
      shortName: stage.name.replace("预备党员", "预备").replace("材料", "")
    })),
    nodeOptions: flow.nodes.map((item) => `${String(item.sourceOrder).padStart(2, "0")} · ${item.title}`),
    selectedNodeIndex: 0,
    selectedNodeTitle: flow.nodes[0].title,
    selectedDate: "",
    maxDate: formatDate(new Date()),
    activeStageId: flow.stages[0].id,
    activeStageAnchor: `stage-${flow.stages[0].id}`,
    showFull: false,
    visibleGroups: [],
    hasCalculated: false,
    calculationSummary: null,
    detail: null,
    detailVisible: false,
    detailOpen: false
  },

  onLoad(options) {
    let index = 0;
    if (options && options.step) {
      const found = flow.nodes.findIndex((item) => item.id === options.step);
      if (found >= 0) index = found;
    }
    this.resultMap = {};
    this.setData({
      selectedNodeIndex: index,
      selectedNodeTitle: flow.nodes[index].title,
      activeStageId: flow.nodes[index].stageId,
      activeStageAnchor: `stage-${flow.nodes[index].stageId}`
    });
    this.refreshGroups();
  },

  selectNode(event) {
    const index = Number(event.detail.value);
    const node = flow.nodes[index];
    this.resultMap = {};
    this.setData({
      selectedNodeIndex: index,
      selectedNodeTitle: node.title,
      activeStageId: node.stageId,
      activeStageAnchor: `stage-${node.stageId}`,
      hasCalculated: false,
      calculationSummary: null,
      showFull: false
    });
    this.refreshGroups();
    setTimeout(() => wx.pageScrollTo({ selector: "#calculationSummary", duration: 260 }), 80);
  },

  selectDate(event) {
    this.setData({ selectedDate: event.detail.value });
  },

  calculate() {
    if (!this.data.selectedDate) {
      wx.showToast({ title: "请填写已知节点日期", icon: "none" });
      return;
    }
    const selected = flow.nodes[this.data.selectedNodeIndex];
    const calculation = calculateTimeline(selected.id, this.data.selectedDate);
    if (!calculation.ok) {
      wx.showToast({ title: calculation.error, icon: "none" });
      return;
    }
    this.resultMap = {};
    calculation.results.forEach((item) => { this.resultMap[item.id] = item.schedule; });
    this.setData({
      hasCalculated: true,
      activeStageId: calculation.selectedStageId,
      calculationSummary: {
        total: calculation.results.length,
        calculable: calculation.calculableCount,
        pending: calculation.pendingCount,
        selectedTitle: calculation.selectedNode.title,
        selectedDate: calculation.selectedDate
      }
    });
    this.refreshGroups();
  },

  selectStage(event) {
    const activeStageId = event.currentTarget.dataset.id;
    this.setData({ activeStageId, activeStageAnchor: `stage-${activeStageId}`, showFull: false });
    this.refreshGroups();
  },

  toggleFull() {
    this.setData({ showFull: !this.data.showFull });
    this.refreshGroups();
  },

  refreshGroups() {
    const selectedOrder = flow.nodes[this.data.selectedNodeIndex].sourceOrder;
    const stages = this.data.showFull ? flow.stages : flow.stages.filter((stage) => stage.id === this.data.activeStageId);
    const visibleGroups = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      sourceStage: stage.sourceStage,
      nodes: stageNodes(stage.id, this.resultMap || {}, this.data.hasCalculated ? selectedOrder : 0)
    }));
    this.setData({ visibleGroups });
  },

  openDetail(event) {
    const node = flow.nodes.find((item) => item.id === event.currentTarget.dataset.id);
    if (!node) return;
    const previous = node.previousStep ? flow.nodes.find((item) => item.id === node.previousStep) : null;
    const next = node.nextStep ? flow.nodes.find((item) => item.id === node.nextStep) : null;
    const schedule = this.resultMap && this.resultMap[node.id];
    clearTimeout(this.drawerTimer);
    this.setData({
      detailVisible: true,
      detailOpen: false,
      detail: Object.assign({}, node, {
        orderText: String(node.sourceOrder).padStart(2, "0"),
        partyText: node.responsibleParties.join("、") || "资料未明确",
        previousText: previous ? `${previous.sourceOrder}. ${previous.title}` : "无",
        nextText: next ? `${next.sourceOrder}. ${next.title}` : "无",
        materialText: node.sourceMaterials.length ? node.sourceMaterials : [node.materialClassification],
        noteList: node.notes.length ? node.notes : ["资料未列明单独备注；请结合现行规定和上级党组织要求核对。"],
        schedule: schedule ? Object.assign({}, schedule, { statusLabel: statusLabel(schedule.status) }) : null
      })
    }, () => {
      this.drawerTimer = setTimeout(() => this.setData({ detailOpen: true }), 20);
    });
  },

  closeDetail() {
    clearTimeout(this.drawerTimer);
    this.setData({ detailOpen: false });
    this.drawerTimer = setTimeout(() => this.setData({ detailVisible: false }), 200);
  },

  preventClose() {},

  openWebsite() {
    wx.navigateTo({
      url: `/pages/webview/webview?title=${encodeURIComponent("发展党员专题资料")}&url=${encodeURIComponent(flow.websiteUrl)}`
    });
  },

  onUnload() {
    clearTimeout(this.drawerTimer);
  }
});
