/**
 * 全局配置开关。
 * - CLOUD_ENV_ID：微信云开发环境 ID。留空 = 纯本地模式（默认，零配置可运行）。
 *   开通方式见 README《启用云开发》。仓库层检测到配置后会自动切换并优雅降级。
 * - FREE_QUOTA：免费用户可开启训练会话的次数上限（Free_Usage_Limit）。
 * - PAID_LABEL：付费墙演示模式标识文案（个人主体无法接微信支付时的合规处理）。
 */
module.exports = {
  CLOUD_ENV_ID: '',
  FREE_QUOTA: 3,
  PAID_LABEL: '演示环境：模拟解锁，不产生真实扣费',
  APP_NAME: '练了吗',
  SLOGAN: '你今天练了吗？',
  // AI 文案润色（微信 AI 生态·云开发大模型）：默认关闭，全部使用模板文案。
  // 开启步骤见 README《启用 AI 文案润色》：需配置云环境 + 部署 llmcoach 云函数。
  // 红线不变：AI 仅润色表达，动作分/计划等数值永远来自确定性模块，模板永远兜底。
  ENABLE_AI_TEXT: false,
};
