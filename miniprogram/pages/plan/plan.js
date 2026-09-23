const app = getApp();
const store = require('../../store/appStore');
const config = require('../../config');

function dayDiff(aIso, bIso) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  const ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

Page({
  data: {
    slogan: config.SLOGAN,
    hasAssessment: false,
    todayDay: null, // 今天对应的计划日
    todayLabel: '',
    isRestDay: false,
    exercises: [],
    weekStrip: [],
    remainingFreeText: '',
    canStart: true,
  },

  onShow() {
    app.onStoreReady(() => this.refresh());
    if (app.globalData.store) this.refresh();
  },

  refresh() {
    const s = store.getState();
    if (!s.assessment || !s.plan) {
      this.setData({ hasAssessment: false });
      return;
    }

    const daysSince = dayDiff(s.assessment.createdAt, new Date().toISOString());
    const todayIndex = ((daysSince % 7) + 7) % 7 + 1;
    const today = s.plan.days.find((d) => d.dayIndex === todayIndex);
    const weekStrip = s.plan.days.map((d) => ({
      dayIndex: d.dayIndex,
      isRestDay: d.isRestDay,
      isToday: d.dayIndex === todayIndex,
      count: d.exercises.length,
    }));

    const freeQuota = config.FREE_QUOTA;
    const ent = s.entitlement;
    const remaining = ent.tier === 'pro' ? '∞' : String(Math.max(0, freeQuota - ent.freeQuotaUsed));

    this.setData({
      hasAssessment: true,
      todayDay: today,
      todayLabel: `第 ${todayIndex} 天`,
      isRestDay: today.isRestDay,
      exercises: today.exercises,
      weekStrip,
      remainingFreeText: ent.tier === 'pro' ? 'Pro 会员 · 不限次数' : `免费额度剩 ${remaining}/${freeQuota} 次`,
      canStart: !today.isRestDay && (ent.tier === 'pro' || ent.freeQuotaUsed < freeQuota),
    });
  },

  goAssessment() {
    wx.navigateTo({ url: '/pages/assessment/assessment' });
  },

  startTraining() {
    if (this.data.isRestDay) {
      wx.showToast({ title: '今天是休息日，好好恢复~', icon: 'none' });
      return;
    }
    const s = store.getState();
    const ent = s.entitlement;
    if (ent.tier !== 'pro' && ent.freeQuotaUsed >= config.FREE_QUOTA) {
      wx.navigateTo({ url: '/pages/paywall/paywall' });
      return;
    }
    wx.navigateTo({ url: `/pages/training/training?dayIndex=${this.data.todayDay.dayIndex}` });
  },

  goPaywall() {
    wx.navigateTo({ url: '/pages/paywall/paywall' });
  },
});
