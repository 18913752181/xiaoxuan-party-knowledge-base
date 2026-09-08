const TASK_API = "https://xiaoxuanvip.com/api/miniprogram/tasks";

function pad(value) { return String(value).padStart(2, "0"); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }

function pageMeta() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "夜深了，先把事情放稳。" : hour < 12 ? "早上好，今天也一起理顺。" : hour < 18 ? "下午好，接着把事情做好。" : "晚上好，今天辛苦了。";
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return { greeting, todayLabel: `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}` };
}

function normalizeTodayTasks(tasks) {
  const today = dateKey(new Date());
  return (Array.isArray(tasks) ? tasks : [])
    .map((item, index) => {
      const reminderAt = item.reminderAt ? new Date(item.reminderAt) : null;
      const validDate = reminderAt && !Number.isNaN(reminderAt.getTime());
      const status = item.status || "pending";
      return {
        id: item.id || `task-${index}`,
        title: String(item.title || "未命名事项"),
        date: validDate ? dateKey(reminderAt) : "",
        timeText: validDate ? `${pad(reminderAt.getHours())}:${pad(reminderAt.getMinutes())}` : "待定",
        status,
        statusClass: status === "completed" ? "is-done" : status === "cancelled" ? "is-cancelled" : "is-pending",
        statusText: status === "completed" ? "已完成" : status === "cancelled" ? "已取消" : "待完成"
      };
    })
    .filter((item) => item.date === today)
    .sort((a, b) => {
      const statusOrder = { pending: 0, completed: 1, cancelled: 2 };
      return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0) || a.timeText.localeCompare(b.timeText);
    });
}

function fetchTasks() {
  return new Promise((resolve, reject) => wx.login({
    success(loginResult) {
      if (!loginResult.code) return reject(new Error("微信登录失败"));
      wx.request({
        url: TASK_API,
        method: "GET",
        header: { "X-WX-Code": loginResult.code },
        success(response) {
          if ((response.statusCode >= 200 && response.statusCode < 300) || response.statusCode === 403) return resolve(response.data || {});
          reject(new Error("请求失败"));
        },
        fail: reject
      });
    },
    fail: reject
  }));
}

Page({
  data: {
    ...pageMeta(),
    dashboardStatus: "loading",
    todayTasks: [],
    hiddenTaskCount: 0,
    todayPendingCount: 0,
    todayCompletedCount: 0
  },
  onShow() {
    const meta = pageMeta();
    this.setData({ ...meta, dashboardStatus: "loading" });
    this.loadTodaySummary();
  },
  async loadTodaySummary() {
    try {
      const payload = await fetchTasks();
      if (!payload.bound) {
        this.setData({ dashboardStatus: "unbound", todayTasks: [], hiddenTaskCount: 0, todayPendingCount: 0, todayCompletedCount: 0 });
        return;
      }
      const allTodayTasks = normalizeTodayTasks(payload.tasks);
      this.setData({
        dashboardStatus: "ready",
        todayTasks: allTodayTasks.slice(0, 3),
        hiddenTaskCount: Math.max(0, allTodayTasks.length - 3),
        todayPendingCount: allTodayTasks.filter((item) => item.status === "pending").length,
        todayCompletedCount: allTodayTasks.filter((item) => item.status === "completed").length
      });
    } catch (error) {
      this.setData({ dashboardStatus: "error", todayTasks: [], hiddenTaskCount: 0, todayPendingCount: 0, todayCompletedCount: 0 });
    }
  },
  openDashboard() {
    wx.navigateTo({ url: "/pages/dashboard/dashboard" });
  },
  startCalculation() {
    wx.navigateTo({ url: "/pages/flow/flow" });
  },
  openBases() {
    wx.navigateTo({ url: "/pages/bases/bases" });
  },
  openMaterials() {
    wx.navigateTo({
      url: `/pages/webview/webview?title=${encodeURIComponent("资料库")}&url=${encodeURIComponent("https://xiaoxuanvip.com/library")}`
    });
  }
});
