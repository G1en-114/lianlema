/**
 * 权益与付费墙（移植原 EntitlementService，本地版）。
 * 纯函数 + 显式注入免费额度上限，Node 可测（对应 Correctness Property 11）。
 */

/**
 * @typedef {{tier:'free'|'pro', freeQuotaUsed:number}} Entitlement
 */

/** @returns {Entitlement} */
function newEntitlement() {
  return { tier: 'free', freeQuotaUsed: 0 };
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

module.exports = {
  newEntitlement,
  remainingFree,
  canStartSession,
  consumeQuota,
  grantPro,
  restorePro,
};
