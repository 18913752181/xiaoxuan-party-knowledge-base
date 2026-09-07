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
function buildPastMonthRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    return {
      key: dateKey(date),
      anchor: `date-${index}`,
      weekday: index === 29 ? "今天" : weekdays[date.getDay()],
      monthDay: `${date.getMonth() + 1}/${date.getDate()}`,
      isToday: index === 29
    };
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
    dates: [], dateScrollTarget: "date-29", selectedKey: "", selectedLabel: "今天", tasks: [], visibleTasks: [],
    pendingCount: 0, completedCount: 0, monthCount: 0, swipedTaskId: "", submittingTaskId: "",
    loading: true, submitting: false, bound: false, active: false,
    bindingCode: "", taskTitle: "", taskDate: "", taskTime: "", errorText: ""
  },
  onLoad() {
    const dates = buildPastMonthRange();
    const schedule = defaultSchedule();
    this.setData({ dates, selectedKey: dates[29].key, taskDate: schedule.date, taskTime: schedule.time });
    this.loadTasks();
  },
  onShow() { if (this.data.dates.length && !this.data.loading) this.loadTasks(); },
  async onPullDownRefresh() {
    await this.loadTasks();
    wx.stopPullDownRefresh();
  },
  async loadTasks() {
    this.setData({ loading: true, errorText: "" });
    try {
      const payload = await apiRequest("", "GET", null, true);
      const tasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeTask) : [];
      this.setData({
        bound: Boolean(payload.bound), active: Boolean(payload.active), swipedTaskId: ""
      });
      this.updateTaskState(tasks);
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
  async completeTask(event) {
    const id = event.currentTarget.dataset.id;
    const current = this.data.tasks.find((item) => item.id === id);
    if (!current || !current.isPending || this.data.submittingTaskId) return;
    const previousTasks = this.data.tasks;
    const tasks = previousTasks.map((item) => item.id === id ? {
      ...item, status: "completed", statusText: "已完成", isPending: false, isDone: true
    } : item);
    this.setData({ submittingTaskId: id, swipedTaskId: "" });
    this.updateTaskState(tasks);
    try {
      await apiRequest("", "PATCH", { id, action: "complete" });
      wx.showToast({ title: "已完成", icon: "success" });
    } catch (error) {
      this.updateTaskState(previousTasks);
      wx.showToast({ title: error.message || "更新失败", icon: "none" });
    } finally { this.setData({ submittingTaskId: "" }); }
  },
  onTaskTouchStart(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    this._taskTouch = {
      id: event.currentTarget.dataset.id,
      x: touch.clientX,
      y: touch.clientY,
      revealed: false
    };
  },
  onTaskTouchMove(event) {
    const start = this._taskTouch;
    const touch = event.touches && event.touches[0];
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < -24 && !start.revealed) {
      start.revealed = true;
      this.setData({ swipedTaskId: start.id });
    } else if (deltaX > 24 && this.data.swipedTaskId) {
      this.setData({ swipedTaskId: "" });
    }
  },
  onTaskTouchEnd(event) {
    const start = this._taskTouch;
    const touch = event.changedTouches && event.changedTouches[0];
    this._taskTouch = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (start.revealed) {
      this._ignoreNextTaskTap = true;
      return;
    }
    if (Math.abs(deltaX) < 30 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    this._ignoreNextTaskTap = true;
    this.setData({ swipedTaskId: deltaX < 0 ? start.id : "" });
  },
  onTaskTap() {
    if (this._ignoreNextTaskTap) {
      this._ignoreNextTaskTap = false;
      return;
    }
    if (this.data.swipedTaskId) this.setData({ swipedTaskId: "" });
  },
  async deleteTask(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.submittingTaskId) return;
    const previousTasks = this.data.tasks;
    const tasks = previousTasks.filter((item) => item.id !== id);
    this.setData({ submittingTaskId: id, swipedTaskId: "" });
    this.updateTaskState(tasks);
    try {
      await apiRequest("", "DELETE", { id });
      wx.showToast({ title: "已删除", icon: "success" });
    } catch (error) {
      this.updateTaskState(previousTasks);
      wx.showToast({ title: error.message || "删除失败", icon: "none" });
    } finally { this.setData({ submittingTaskId: "" }); }
  },
  selectDate(event) {
    const selectedKey = event.currentTarget.dataset.key;
    const selected = this.data.dates.find((item) => item.key === selectedKey);
    if (!selected) return;
    this.setData({ selectedKey, selectedLabel: selected.isToday ? "今天" : selected.monthDay, swipedTaskId: "" });
    this.applyDateFilter(selectedKey, this.data.tasks);
  },
  updateTaskState(tasks) {
    const monthKeys = new Set(this.data.dates.map((item) => item.key));
    const monthTasks = tasks.filter((item) => monthKeys.has(item.dateKey));
    this.setData({
      tasks,
      pendingCount: monthTasks.filter((item) => item.status === "pending").length,
      completedCount: monthTasks.filter((item) => item.status === "completed").length,
      monthCount: monthTasks.length
    });
    this.applyDateFilter(this.data.selectedKey, tasks);
  },
  applyDateFilter(selectedKey, tasks) { this.setData({ visibleTasks: tasks.filter((item) => item.dateKey === selectedKey) }); }
});
