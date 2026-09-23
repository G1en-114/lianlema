const store = require('../../store/appStore');
const config = require('../../config');
const entitlement = require('../../core/entitlement');
const { modelService } = require('../../providers/model/modelServiceProvider');

// 云端不可达/未连接时的本地兜底套餐目录（与 backend TIERS 保持同一结构）。
const LOCAL_TIERS = [
  {
    id: 'free',
    name: '免费版',
    price: '¥0',
    period: '永久',
    quota: '每日 3 次端侧动作分析',
    features: ['端侧姿态识别与纠错', '7 天计划与打卡', 'AI 教练每日 3 问'],
  },
  {
    id: 'pro',
    name: 'Pro 订阅',
    price: '¥29',
    period: '月',
    quota: '云端模型服务不限次',
    features: [
      '云端 ST-GCN 动作识别',
      '多模态快照分析（VLM）',
      'AI 教练无限对话',
      '训练报告深度解读',
    ],
  },
  {
    id: 'booster',
    name: '按次加油包',
    price: '¥9.9',
    period: '10 次云端分析',
    quota: '云端动作分析 10 次',
    features: ['适合偶尔加练', '云端报告解读', '不过期'],
  },
];

Page({
  data: {
    paidLabel: config.PAID_LABEL,
    tiers: LOCAL_TIERS,
    currentTier: 'free',
    creditsText: '0 次（Pro 不限次）',
  },

  onShow() {
    this.refresh();
    // 套餐目录优先取云端（售卖面由模型服务统一管理），失败用本地兜底。
    if (modelService.available()) {
      modelService
        .tiers()
        .then((res) => {
          if (res && Array.isArray(res.tiers) && res.tiers.length === 3) {
            this.setData({ tiers: res.tiers });
          }
        })
        .catch(() => { /* 本地兜底已就位 */ });
    }
  },

  refresh() {
    const ent = store.getState().entitlement;
    this.setData({
      currentTier: ent.tier,
      creditsText:
        ent.tier === 'pro'
          ? '不限次'
          : `${entitlement.remainingCloudCredits(ent)} 次`,
    });
  },

  applyEntitlement(next) {
    require('../../providers/repo/index').getRepo().saveEntitlement(next);
    store.setState({ entitlement: next });
    this.refresh();
  },

  purchasePro() {
    // 个人主体无法开通微信支付：演示模式明示模拟解锁（合规红线：不展示真实收款能力）。
    wx.showModal({
      title: '演示环境',
      content: config.PAID_LABEL + '。是否模拟订阅 Pro（云端模型不限次）？',
      confirmText: '模拟订阅',
      success: (r) => {
        if (!r.confirm) return;
        this.applyEntitlement(entitlement.grantPro(store.getState().entitlement));
        wx.showToast({ title: '已订阅 Pro（演示）', icon: 'success' });
      },
    });
  },

  purchaseBooster() {
    wx.showModal({
      title: '演示环境',
      content: config.PAID_LABEL + '。是否模拟购买加油包（云端分析 +10 次）？',
      confirmText: '模拟购买',
      success: (r) => {
        if (!r.confirm) return;
        this.applyEntitlement(entitlement.addCloudCredits(store.getState().entitlement, 10));
        wx.showToast({ title: '已到账 10 次（演示）', icon: 'success' });
      },
    });
  },

  restore() {
    // 企业主体接入微信支付后，此处替换为真实凭证校验/恢复购买。
    wx.showToast({ title: '演示版暂无可恢复的购买', icon: 'none' });
  },
});
