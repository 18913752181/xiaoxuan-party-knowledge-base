const TASK_API = "https://xiaoxuanvip.com/api/miniprogram/tasks";

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function defaultSchedule() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0);
  return { date: dateKey(date), time: `${pad(date.getHours())}:${pad(date.getMinutes())}` };
}
function buildWeek() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 3);
    return { key: dateKey(date), weekday: weekdays[date.getDay()], day: pad(date.getDate()), isToday: index === 3 };
  });
}
function formatCreatedAt(value) {
  const date = parseDate(value);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}` : "创建时间未知";
}
function normalizeTask(item, index) {
  const scheduledAt = parseDate(item.reminderAt);
  const status = item.status || "pending";
  return {
    id: item.id || `task-${index}`,
    content: String(item.title || "未命名事项"),
    dateKey: scheduledAt ? dateKey(scheduledAt) : "",
    timeText: scheduledAt ? `${pad(scheduledAt.getHours())}:${pad(scheduledAt.getMinutes())}` : "时间待定",
    status,
    isPending: status === "pending",
    isDone: status === "completed",
    statusText: status === "completed" ? "已完成" : status === "cancelled" ? "已取消" : "待完成",
    sourceText: item.source === "miniprogram" ? "小程序" : "Dimmo",
    createdText: formatCreatedAt(item.createdAt)
  };
}
function apiRequest(path, method, data, allowForbidden) {
  return new Promise((resolve, reject) => wx.login({
    success(loginResult) {
      if (!loginResult.code) return reject(new Error("微信登录失败"));
      wx.request({
        url: `${TASK_API}${path || ""}`,
        method: method || "GET",
        data: data || undefined,
        header: { "X-WX-Code": loginResult.code, "Content-Type": "application/json" },
        success(response) {
          if ((response.statusCode >= 200 && response.statusCode < 300) || (allowForbidden && response.statusCode === 403)) return resolve(response.data || {});
          reject(new Error((response.data && response.data.error) || "请求失败"));
        },
        fail: reject
      });
    },
    fail: reject
  }));
}

Page({
  data: {
    week: [], selectedKey: "", selectedLabel: "今天", tasks: [], visibleTasks: [],
    pendingCount: 0, completedCount: 0, weekCount: 0,
    loading: true, submitting: false, bound: false, active: false,
    bindingCode: "", taskTitle: "", taskDate: "", taskTime: "", errorText: ""
  },
  onLoad() {
    const week = buildWeek();
    const schedule = defaultSchedule();
    this.setData({ week, selectedKey: week[3].key, taskDate: schedule.date, taskTime: schedule.time });
    this.loadTasks();
  },
  onShow() { if (this.data.week.length && !this.data.loading) this.loadTasks(); },
  async onPullDownRefresh() {
    await this.loadTasks();
    wx.stopPullDownRefresh();
  },
  async loadTasks() {
    this.setData({ loading: true, errorText: "" });
    try {
      const payload = await apiRequest("", "GET", null, true);
      const tasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeTask) : [];
      const weekKeys = new Set(this.data.week.map((item) => item.key));
      this.setData({
        bound: Boolean(payload.bound), active: Boolean(payload.active), tasks,
        pendingCount: tasks.filter((item) => item.status === "pending").length,
        completedCount: tasks.filter((item) => item.status === "completed").length,
        weekCount: tasks.filter((item) => weekKeys.has(item.dateKey)).length
      });
      this.applyDateFilter(this.data.selectedKey, tasks);
    } catch (error) {
      this.setData({ errorText: error.message || "看板暂时无法同步" });
    } finally { this.setData({ loading: false }); }
  },
  onBindingCodeInput(event) { this.setData({ bindingCode: String(event.detail.value || "").replace(/\D/g, "").slice(0, 8) }); },
  async bindAccount() {
    if (this.data.bindingCode.length !== 8 || this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await apiRequest("/bind", "POST", { bindingCode: this.data.bindingCode });
      wx.showToast({ title: "绑定成功", icon: "success" });
      this.setData({ bindingCode: "" });
      await this.loadTasks();
    } catch (error) { wx.showToast({ title: error.message || "绑定失败", icon: "none" }); }
    finally { this.setData({ submitting: false }); }
  },
  onTaskTitleInput(event) { this.setData({ taskTitle: event.detail.value }); },
  onTaskDateChange(event) { this.setData({ taskDate: event.detail.value }); },
  onTaskTimeChange(event) { this.setData({ taskTime: event.detail.value }); },
  async createTask() {
    const title = this.data.taskTitle.trim();
    if (!title) return wx.showToast({ title: "先填写事项名称", icon: "none" });
    if (this.data.submitting) return;
    const reminderAt = new Date(`${this.data.taskDate}T${this.data.taskTime}:00+08:00`).toISOString();
    this.setData({ submitting: true });
    try {
      await apiRequest("", "POST", { title, reminderAt });
      wx.showToast({ title: "已加入看板", icon: "success" });
      this.setData({ taskTitle: "" });
      await this.loadTasks();
    } catch (error) { wx.showToast({ title: error.message || "创建失败", icon: "none" }); }
    finally { this.setData({ submitting: false }); }
  },
  async updateTask(event) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    if (!id || !action || this.data.submitting) return;
    const confirmed = await new Promise((resolve) => wx.showModal({
      title: action === "complete" ? "标记完成" : "取消事项",
      content: action === "complete" ? "Dimmo 端也会同步显示为已完成。" : "Dimmo 端也会同步显示为已取消。",
      success: (result) => resolve(result.confirm)
    }));
    if (!confirmed) return;
    this.setData({ submitting: true });
    try {
      await apiRequest("", "PATCH", { id, action });
      wx.showToast({ title: action === "complete" ? "已完成" : "已取消", icon: "success" });
      await this.loadTasks();
    } catch (error) { wx.showToast({ title: error.message || "更新失败", icon: "none" }); }
    finally { this.setData({ submitting: false }); }
  },
  selectDate(event) {
    const selectedKey = event.currentTarget.dataset.key;
    const selected = this.data.week.find((item) => item.key === selectedKey);
    if (!selected) return;
    this.setData({ selectedKey, selectedLabel: selected.isToday ? "今天" : `${Number(selected.day)}日` });
    this.applyDateFilter(selectedKey, this.data.tasks);
  },
  applyDateFilter(selectedKey, tasks) { this.setData({ visibleTasks: tasks.filter((item) => item.dateKey === selectedKey) }); }
});
