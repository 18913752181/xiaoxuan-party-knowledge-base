const { config, calculate, formatDate } = require("../../utils/time-calculator");

const INPUT_KEY = "party_time_assistant_input_v1";
const RESULT_KEY = "party_time_assistant_result_v1";

Page({
  data: {
    fields: [],
    maxDate: "",
    hasSavedValues: false
  },

  onLoad() {
    const saved = wx.getStorageSync(INPUT_KEY) || {};
    const fields = config.fields.map((field, index) => ({
      ...field,
      order: index + 1,
      value: saved[field.key] || ""
    }));
    this.setData({
      fields,
      maxDate: formatDate(new Date()),
      hasSavedValues: fields.some((field) => field.value)
    });
  },

  selectDate(event) {
    const key = event.currentTarget.dataset.key;
    const fields = this.data.fields.map((field) => field.key === key ? { ...field, value: event.detail.value } : field);
    this.setData({ fields, hasSavedValues: true });
  },

  clearDate(event) {
    const key = event.currentTarget.dataset.key;
    const fields = this.data.fields.map((field) => field.key === key ? { ...field, value: "" } : field);
    this.setData({ fields, hasSavedValues: fields.some((field) => field.value) });
  },

  resetForm() {
    wx.showModal({
      title: "清空已填日期？",
      content: "只会清除保存在本机的本次核算日期。",
      confirmColor: "#e39a68",
      success: (result) => {
        if (!result.confirm) return;
        const fields = this.data.fields.map((field) => ({ ...field, value: "" }));
        wx.removeStorageSync(INPUT_KEY);
        wx.removeStorageSync(RESULT_KEY);
        this.setData({ fields, hasSavedValues: false });
      }
    });
  },

  submit() {
    const values = {};
    this.data.fields.forEach((field) => { values[field.key] = field.value || ""; });
    if (!values.applicationDate) {
      wx.showToast({ title: "请先填写申请书日期", icon: "none" });
      return;
    }
    const result = calculate(values);
    wx.setStorageSync(INPUT_KEY, values);
    wx.setStorageSync(RESULT_KEY, result);
    wx.navigateTo({ url: "/pages/result/result" });
  }
});
