/**
 * 权益与付费墙（移植原 EntitlementService，本地版）。
 * 纯函数 + 显式注入免费额度上限，Node 可测（对应 Correctness Property 11）。
 */

/**
 * @typedef {{tier:'free'|'pro', freeQuotaUsed:number, cloudCredits:number}} Entitlement
 */

/** @returns {Entitlement} */
function newEntitlement() {
  return { tier: 'free', freeQuotaUsed: 0, cloudCredits: 0 };
}

/**
 * 免费用户剩余开训次数；pro 返回 Infinity。
 * @param {Entitlement} ent
 * @param {number} freeQuota
 */
function remainingFree(ent, freeQuota) {
  if (ent.tier === 'pro') return Infinity;
  return Math.max(0, freeQuota - ent.freeQuotaUsed);
}

/**
 * 是否允许开启训练会话（false = 应展示付费墙）。
 * @param {Entitlement} ent
 * @param {number} freeQuota
 */
function canStartSession(ent, freeQuota) {
  return remainingFree(ent, freeQuota) > 0;
}

/**
 * 开启会话后消耗一次免费额度；pro 不计额。
 * @param {Entitlement} ent
 * @returns {Entitlement}
 */
function consumeQuota(ent) {
  if (ent.tier === 'pro') return ent;
  return { ...ent, freeQuotaUsed: ent.freeQuotaUsed + 1 };
}

/** 演示模式解锁（个人主体无法接微信支付；企业主体可在此替换为微信支付凭证校验）。 */
function grantPro(ent) {
  return { ...ent, tier: 'pro' };
}

/** 演示模式恢复购买：无真实凭证体系，恒回退当前状态（对应原需求 8.7 的占位）。 */
function restorePro(ent) {
  return ent;
}

// ---- 云端模型服务额度（天猫黑客松 AI 服务版） ----
// 免费用户消耗 cloudCredits（加油包），Pro 订阅云端不限次。

/** Pro 云端不限次；免费返回剩余云端次数（旧存量数据无该字段时视为 0）。 */
function remainingCloudCredits(ent) {
  if (ent.tier === 'pro') return Infinity;
  return ent.cloudCredits || 0;
}

/** 是否允许调用云端模型服务（false = 引导订阅/购买加油包）。 */
function canUseCloud(ent) {
  return remainingCloudCredits(ent) > 0;
}

/** 购买加油包：增加 n 次云端额度（叠加不清零）。 */
function addCloudCredits(ent, n) {
  return { ...ent, cloudCredits: (ent.cloudCredits || 0) + n };
}

/** 消耗一次云端额度；Pro 不计，免费不足时原样返回（调用方需先查 canUseCloud）。 */
function consumeCloudCredit(ent) {
  if (ent.tier === 'pro') return ent;
  const left = ent.cloudCredits || 0;
  if (left <= 0) return ent;
  return { ...ent, cloudCredits: left - 1 };
}

module.exports = {
  newEntitlement,
  remainingFree,
  canStartSession,
  consumeQuota,
  grantPro,
  restorePro,
  remainingCloudCredits,
  canUseCloud,
  addCloudCredits,
  consumeCloudCredit,
};
