const store = require('../../store/appStore');
const config = require('../../config');
const entitlement = require('../../core/entitlement');

Page({
  data: {
    paidLabel: config.PAID_LABEL,
    benefits: [
      '不限训练次数（免费版每周期 ' + config.FREE_QUOTA + ' 次）',
      '完整姿态识别与实时纠错',
      '语音命令与真人音色播报',
      '训练历史与进步追踪',
    ],
  },

  purchase() {
    // 个人主体无法开通微信支付：演示模式明示模拟解锁（合规红线：不展示真实收款能力）。
    wx.showModal({
      title: '演示环境',
      content: config.PAID_LABEL + '。是否模拟解锁 Pro 会员？',
      confirmText: '模拟解锁',
      success: (r) => {
        if (!r.confirm) return;
        const ent = entitlement.grantPro(store.getState().entitlement);
        require('../../providers/repo/index').getRepo().saveEntitlement(ent);
        store.setState({ entitlement: ent });
        wx.showToast({ title: '已解锁 Pro（演示）', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      },
    });
  },

  restore() {
    // 企业主体接入微信支付后，此处替换为真实凭证校验/恢复购买。
    wx.showToast({ title: '演示版暂无可恢复的购买', icon: 'none' });
  },
});
