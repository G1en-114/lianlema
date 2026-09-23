const { getState, hydrate } = require('./store/appStore');
const { initRepo } = require('./providers/repo/index');

App({
  onLaunch() {
    // 隐私弹窗引导（基础库 2.32.3+；后台需同步配置《用户隐私保护指引》）
    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization((resolve) => {
        wx.showModal({
          title: '隐私保护提示',
          content:
            '训练纠错需要使用摄像头，语音命令需要使用麦克风；伤痛自评属敏感健康信息，将单独征求你的同意。数据仅保存在你的手机或你自己的云环境中。',
          confirmText: '同意',
          cancelText: '拒绝',
          success(res) {
            resolve({ buttonId: res.confirm ? 'agree-btn' : '', event: res.confirm ? 'agree' : 'disagree' });
          },
        });
      });
    }

    // 仓库层：配置了云环境则尝试云端，失败自动降级本地
    initRepo().then(async ({ mode }) => {
      this.globalData.repoMode = mode;
      await hydrate();
      this.globalData.store = getState();
      this.storeReadyListeners.forEach((fn) => fn(this.globalData.store));
    });
  },

  globalData: {
    repoMode: 'local',
    store: null,
  },

  storeReadyListeners: [],

  onStoreReady(fn) {
    if (this.globalData.store) {
      fn(this.globalData.store);
    } else {
      this.storeReadyListeners.push(fn);
    }
  },
});
