/**
 * 智能日常钩子与云端额度（天猫黑客松 AI 服务版）单元测试：
 * - core/streak：连续打卡（今天未练不打断、跨月、空历史）
 * - core/dailyPicks：分时段微训练推荐（确定性）
 * - core/entitlement 云端额度：加油包/消耗/Pro 不限次
 * - providers/model：body-18 → COCO-17 重排
 */

const test = require('node:test');
const assert = require('node:assert');

const { computeStreak, dayKey } = require('../miniprogram/core/streak');
const { MICRO_SESSIONS, pickForHour, dailyPicks } = require('../miniprogram/core/dailyPicks');
const entitlement = require('../miniprogram/core/entitlement');
const { toCoco17 } = require('../miniprogram/providers/model/modelServiceProvider');

function isoAt(date, hour = 20) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
  return d.toISOString();
}

// ---- streak ----

test('streak: 空历史与无效记录返回 0', () => {
  assert.strictEqual(computeStreak([]), 0);
  assert.strictEqual(computeStreak(null), 0);
  assert.strictEqual(computeStreak([{ endedAt: null }, {}]), 0);
});

test('streak: 今天已练计入今天', () => {
  const now = new Date(2026, 8, 23, 21, 0);
  const sessions = [{ endedAt: isoAt(now) }];
  assert.strictEqual(computeStreak(sessions, now), 1);
});

test('streak: 今天未练不打断（从昨天起算）', () => {
  const now = new Date(2026, 8, 23, 9, 0);
  const y = new Date(2026, 8, 22);
  const d = new Date(2026, 8, 21);
  assert.strictEqual(computeStreak([{ endedAt: isoAt(y) }, { endedAt: isoAt(d) }], now), 2);
});

test('streak: 断卡只数到最近连续段', () => {
  const now = new Date(2026, 8, 23, 9, 0);
  const days = [new Date(2026, 8, 22), new Date(2026, 8, 19), new Date(2026, 8, 18)];
  assert.strictEqual(computeStreak(days.map((d) => ({ endedAt: isoAt(d) })), now), 1);
});

test('streak: 跨月连续正确（8/31 → 9/1）', () => {
  const now = new Date(2026, 8, 2, 9, 0);
  const days = [new Date(2026, 8, 1), new Date(2026, 7, 31), new Date(2026, 7, 30)];
  assert.strictEqual(computeStreak(days.map((d) => ({ endedAt: isoAt(d) })), now), 3);
});

test('streak: 一天多练只记一次', () => {
  const now = new Date(2026, 8, 23, 21, 0);
  const sessions = [
    { endedAt: isoAt(now) },
    { endedAt: isoAt(now, 8) },
    { endedAt: isoAt(new Date(2026, 8, 22)) },
  ];
  assert.strictEqual(computeStreak(sessions, now), 2);
});

// ---- dailyPicks ----

test('picks: 四个时段各归其位（确定性）', () => {
  assert.strictEqual(pickForHour(7).id, 'morning');
  assert.strictEqual(pickForHour(12).id, 'noon');
  assert.strictEqual(pickForHour(15).id, 'deskbreak');
  assert.strictEqual(pickForHour(20).id, 'evening');
});

test('picks: 0-6 点归入睡前放松', () => {
  assert.strictEqual(pickForHour(2).id, 'evening');
});

test('picks: dailyPicks 返回主推 + 工作日/周末文案', () => {
  const workday = dailyPicks(new Date(2026, 8, 23, 15, 0)); // 周三
  assert.strictEqual(workday.primary.id, 'deskbreak');
  assert.ok(workday.note.includes('工作日'));

  const weekend = dailyPicks(new Date(2026, 8, 26, 15, 0)); // 周六
  assert.ok(weekend.note.includes('周末'));
});

test('picks: 每个微训练都有标题/时长/至少 3 个条目', () => {
  for (const s of MICRO_SESSIONS) {
    assert.ok(s.title && s.minutes >= 1 && s.items.length >= 3);
    assert.ok(s.focus);
  }
});

// ---- entitlement 云端额度 ----

test('credits: 免费版默认 0，加油包叠加，消耗递减到 0 不为负', () => {
  let ent = entitlement.newEntitlement();
  assert.strictEqual(entitlement.remainingCloudCredits(ent), 0);
  assert.strictEqual(entitlement.canUseCloud(ent), false);

  ent = entitlement.addCloudCredits(ent, 10);
  assert.strictEqual(entitlement.remainingCloudCredits(ent), 10);
  assert.strictEqual(entitlement.canUseCloud(ent), true);

  ent = entitlement.consumeCloudCredit(ent);
  assert.strictEqual(entitlement.remainingCloudCredits(ent), 9);

  let zero = entitlement.addCloudCredits(entitlement.newEntitlement(), 1);
  zero = entitlement.consumeCloudCredit(zero);
  zero = entitlement.consumeCloudCredit(zero); // 不足时原样返回
  assert.strictEqual(entitlement.remainingCloudCredits(zero), 0);
});

test('credits: Pro 云端不限次且消耗不改变状态', () => {
  const pro = entitlement.grantPro(entitlement.newEntitlement());
  assert.strictEqual(entitlement.remainingCloudCredits(pro), Infinity);
  assert.strictEqual(entitlement.canUseCloud(pro), true);
  assert.deepStrictEqual(entitlement.consumeCloudCredit(pro), pro);
});

test('credits: 旧存量数据（无 cloudCredits 字段）按 0 处理', () => {
  const legacy = { tier: 'free', freeQuotaUsed: 2 };
  assert.strictEqual(entitlement.remainingCloudCredits(legacy), 0);
  assert.strictEqual(entitlement.addCloudCredits(legacy, 5).cloudCredits, 5);
});

// ---- COCO-17 重排 ----

test('toCoco17: body-18 → COCO-17 映射正确（含缺失点填 0）', () => {
  // body-18: 0 nose, 5 l_shoulder, 2 r_shoulder, 11 l_hip, 8 r_hip, 12 l_knee, 9 r_knee
  const points = Array.from({ length: 14 }, (_, i) => ({ x: i * 10, y: i * 10 + 1 }));
  const coco = toCoco17(points);

  assert.strictEqual(coco.length, 17);
  assert.deepStrictEqual(coco[0], [0, 1]); // nose ← b18[0]
  assert.deepStrictEqual(coco[5], [50, 51]); // l_shoulder ← b18[5]
  assert.deepStrictEqual(coco[6], [20, 21]); // r_shoulder ← b18[2]
  assert.deepStrictEqual(coco[11], [110, 111]); // l_hip ← b18[11]
  assert.deepStrictEqual(coco[12], [80, 81]); // r_hip ← b18[8]
  assert.deepStrictEqual(coco[13], [120, 121]); // l_knee ← b18[12]
  assert.deepStrictEqual(coco[14], [90, 91]); // r_knee ← b18[9]
  assert.deepStrictEqual(coco[1], [0, 0]); // 眼部无对应点
});
