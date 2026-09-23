const app = getApp();
const store = require('../../store/appStore');
const config = require('../../config');
const { computeStreak } = require('../../core/streak');
const { dailyPicks } = require('../../core/dailyPicks');
const { modelService } = require('../../providers/model/modelServiceProvider');

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
    streakDays: 0,
    pickTitle: '',
    pickMinutes: 0,
    pickFocus: '',
    pickItems: [],
    pickNote: '',
    cloudBadge: '',
  },

  onShow() {
    app.onStoreReady(() => this.refresh());
    if (app.globalData.store) this.refresh();
  },

  refresh() {
    const s = store.getState();
    const pick = dailyPicks();
    const streakDays = computeStreak(s.sessions);

    let cloudBadge = '未连接云端模型服务';
    if (modelService.available()) {
      modelService
        .status()
        .then((st) => {
          const on = [];
          if (st.stgcn) on.push('ST-GCN');
          if (st.vlm) on.push('VLM');
          if (st.llm) on.push('LLM');
          this.setData({ cloudBadge: on.length ? `云端 AI 已就绪：${on.join(' · ')}` : '云端模型未配置（端侧可用）' });
        })
        .catch(() => this.setData({ cloudBadge: '云端模型服务不可达（端侧可用）' }));
    }

    this.setData({
      streakDays,
      pickTitle: pick.primary.title,
      pickMinutes: pick.primary.minutes,
      pickFocus: pick.primary.focus,
      pickItems: pick.primary.items,
      pickNote: pick.note,
      cloudBadge,
    });

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

  goCoach() {
    wx.navigateTo({ url: '/pages/coach/coach' });
  },

  startPick() {
    // 微训练不占训练额度、不开摄像头：直接跳 AI 教练跟练。
    wx.navigateTo({ url: '/pages/coach/coach?prompt=' + encodeURIComponent('带我练' + this.data.pickTitle) });
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
