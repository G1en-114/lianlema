const app = getApp();
const store = require('../../store/appStore');

Page({
  data: {
    sessions: [],
    empty: true,
  },

  onShow() {
    app.onStoreReady(() => this.refresh());
    if (app.globalData.store) this.refresh();
  },

  refresh() {
    const sessions = store.getState().sessions || [];
    this.setData({
      sessions: sessions.map((r) => ({
        ...r,
        dateText: this.fmt(r.endedAt || r.startedAt),
      })),
      empty: sessions.length === 0,
    });
  },

  fmt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  openReport(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/report/report?id=${id}` });
  },
});
