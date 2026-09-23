const app = getApp();
const store = require('../../store/appStore');

Page({
  data: {
    repoMode: 'local',
    consentGranted: false,
    cameraAuth: false,
    recordAuth: false,
  },

  onShow() {
    app.onStoreReady(() => this.refresh());
    if (app.globalData.store) this.refresh();
  },

  refresh() {
    const s = store.getState();
    wx.getSetting({
      success: (res) => {
        this.setData({
          repoMode: app.globalData.repoMode,
          consentGranted: !!(s.consent && s.consent.sensitiveHealth),
          cameraAuth: res.authSetting['scope.camera'] === true,
          recordAuth: res.authSetting['scope.record'] === true,
        });
      },
    });
  },

  openPrivacyContract() {
    if (wx.openPrivacyContract) {
      wx.openPrivacyContract({});
    } else {
      wx.showToast({ title: '当前微信版本不支持', icon: 'none' });
    }
  },

  revokeConsent() {
    wx.showModal({
      title: '撤回敏感信息同意',
      content: '撤回后将立即清空伤痛自评数据，并按无伤痛约束重新生成计划。确定撤回？',
      success: (r) => {
        if (r.confirm) {
          store.revokeSensitiveConsent();
          wx.showToast({ title: '已撤回并清空', icon: 'success' });
          this.refresh();
        }
      },
    });
  },

  openSetting() {
    wx.openSetting({});
  },

  clearData() {
    wx.showModal({
      title: '清除全部数据',
      content: '将删除评估、计划与训练历史（本机）。此操作不可恢复。',
      confirmText: '删除',
      confirmColor: '#DC2626',
      success: (r) => {
        if (r.confirm) {
          store.resetAll();
          wx.showToast({ title: '已清除', icon: 'success' });
          this.refresh();
        }
      },
    });
  },
});
