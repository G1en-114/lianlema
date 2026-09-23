const test = require('node:test');
const assert = require('node:assert');
const ent = require('../miniprogram/core/entitlement');

const QUOTA = 3;

test('免费用户额度内可开训，达到上限触发付费墙（Property 11）', () => {
  let e = ent.newEntitlement();
  assert.ok(ent.canStartSession(e, QUOTA));
  e = ent.consumeQuota(e);
  e = ent.consumeQuota(e);
  assert.ok(ent.canStartSession(e, QUOTA));
  e = ent.consumeQuota(e);
  assert.strictEqual(ent.remainingFree(e, QUOTA), 0);
  assert.ok(!ent.canStartSession(e, QUOTA));
});

test('pro 不计额、永不受限（Property 11）', () => {
  let e = ent.grantPro(ent.newEntitlement());
  for (let i = 0; i < 10; i++) e = ent.consumeQuota(e);
  assert.strictEqual(e.freeQuotaUsed, 0);
  assert.strictEqual(ent.remainingFree(e, QUOTA), Infinity);
  assert.ok(ent.canStartSession(e, QUOTA));
});

test('演示解锁/恢复购买行为', () => {
  const e = ent.grantPro(ent.newEntitlement());
  assert.strictEqual(e.tier, 'pro');
  // 恢复购买在演示模式下回退当前状态
  assert.strictEqual(ent.restorePro(ent.newEntitlement()).tier, 'free');
});

test('consume 不改变原对象（纯函数）', () => {
  const e = ent.newEntitlement();
  const e2 = ent.consumeQuota(e);
  assert.strictEqual(e.freeQuotaUsed, 0);
  assert.strictEqual(e2.freeQuotaUsed, 1);
});
