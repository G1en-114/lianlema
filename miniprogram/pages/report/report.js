const store = require('../../store/appStore');
const coachProvider = require('../../providers/coach/coachProvider');

Page({
  data: {
    report: null,
    fromHistory: false,
    dateText: '',
  },

  onLoad(options) {
    if (options && options.id) {
      const s = store.getState();
      const record = s.sessions.find((r) => r.id === options.id);
      if (record) {
        this.setData({
          report: record.report,
          fromHistory: true,
          dateText: this.fmt(record.endedAt || record.startedAt),
        });
      }
    } else {
      const s = store.getState();
      this.setData({ report: s.report, dateText: this.fmt(new Date().toISOString()) });
    }
    if (!this.data.report) {
      wx.showToast({ title: '没有报告数据', icon: 'none' });
      setTimeout(() => wx.switchTab({ url: '/pages/plan/plan' }), 800);
      return;
    }
    // AI 教练小结润色（可选增强）：模板已展示，润色到达后无感替换。
    if (!options.id && coachProvider.available() && this.data.report.summaryText) {
      const original = this.data.report.summaryText;
      coachProvider.polish(original, { scene: 'summary' }).then((better) => {
        if (better && better !== original) this.setData({ 'report.summaryText': better });
      });
    }
  },

  fmt(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  backToPlan() {
    wx.switchTab({ url: '/pages/plan/plan' });
  },
});
