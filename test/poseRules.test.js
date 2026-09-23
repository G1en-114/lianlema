const test = require('node:test');
const assert = require('node:assert');
const { computeAngles, RepCounter, evaluateRep, severityFromDeviation } = require('../miniprogram/core/poseRules');

/** 构造标准站姿骨架（y 向下，屏幕坐标）：返回 VK 风格 points + confidence。 */
function standingSkeleton() {
  const pts = [];
  pts[0] = { x: 100, y: 30 }; // nose
  pts[1] = { x: 100, y: 60 }; // neck
  pts[2] = { x: 120, y: 60 }; // r_shoulder
  pts[3] = { x: 122, y: 100 }; // r_elbow（手臂伸直下垂）
  pts[4] = { x: 122, y: 140 }; // r_wrist
  pts[5] = { x: 80, y: 60 }; // l_shoulder
  pts[6] = { x: 78, y: 100 }; // l_elbow
  pts[7] = { x: 78, y: 140 }; // l_wrist
  pts[8] = { x: 112, y: 160 }; // r_hip
  pts[9] = { x: 111, y: 230 }; // r_knee（腿伸直）
  pts[10] = { x: 110, y: 300 }; // r_ankle
  pts[11] = { x: 88, y: 160 }; // l_hip
  pts[12] = { x: 89, y: 230 }; // l_knee
  pts[13] = { x: 90, y: 300 }; // l_ankle
  return { points: pts, confidence: pts.map(() => 0.95) };
}

test('computeAngles：直立时膝/髋/肘接近 180°，躯干前倾接近 0°', () => {
  const { points, confidence } = standingSkeleton();
  const { angles, torsoLean, meanConfidence } = computeAngles(points, confidence);
  assert.ok(angles.l_knee > 175, `l_knee=${angles.l_knee}`);
  assert.ok(angles.r_hip > 160, `r_hip=${angles.r_hip}`);
  assert.ok(angles.l_elbow > 175, `l_elbow=${angles.l_elbow}`);
  assert.ok(torsoLean < 5, `torsoLean=${torsoLean}`);
  assert.ok(meanConfidence > 0.9);
});

function frame(primaryKneeDeg, overrides = {}) {
  return {
    angles: {
      l_knee: primaryKneeDeg,
      r_knee: primaryKneeDeg,
      l_hip: 170,
      r_hip: 170,
      l_elbow: 170,
      r_elbow: 170,
      l_shoulder: 20,
      r_shoulder: 20,
      ...overrides,
    },
    torsoLean: 10,
    meanConfidence: 0.9,
    ...overrides.frame,
  };
}

test('计数状态机：蹲下-站起完成 1 次标准 rep', () => {
  const rc = new RepCounter('squat');
  assert.strictEqual(rc.update(frame(175)).repCompleted, false); // idle→up
  const e1 = rc.update(frame(170));
  assert.strictEqual(e1.repCompleted, false); // up 状态但为抖动，忽略
  rc.update(frame(105)); // → down
  const done = rc.update(frame(172)); // → 完成
  assert.strictEqual(done.repCompleted, true);
  assert.strictEqual(done.analysis.isStandard, true);
  assert.strictEqual(done.analysis.status, 'conclusive');
});

test('浅幅 rep：下探未到位按不完整结算，给深度纠正', () => {
  const rc = new RepCounter('squat');
  rc.update(frame(175));
  rc.update(frame(170));
  rc.update(frame(125)); // 未到 110，留在 up
  const out = rc.update(frame(172)); // 回到顶部 → partial
  assert.strictEqual(out.partial, true);
  assert.strictEqual(out.repCompleted, false);
  assert.strictEqual(out.analysis.isStandard, false);
  assert.ok(out.analysis.problemAreas.some((p) => p.area === 'shallow_depth'));
});

test('弓背：底部躯干前倾超限 → back_rounding', () => {
  const rc = new RepCounter('squat');
  rc.update(frame(175));
  const bottom = frame(100, { frame: { torsoLean: 60 } });
  rc.update(bottom);
  const done = rc.update(frame(172, { frame: { torsoLean: 15 } }));
  assert.strictEqual(done.repCompleted, true);
  assert.ok(done.analysis.problemAreas.some((p) => p.area === 'back_rounding'));
  assert.strictEqual(done.analysis.isStandard, false);
});

test('关键点置信度过低：状态机忽略该帧，不误计数', () => {
  const rc = new RepCounter('squat');
  rc.update(frame(175));
  rc.update(frame(170));
  const ignored = rc.update(frame(100, { frame: { meanConfidence: 0.3 } }));
  assert.strictEqual(ignored.repCompleted, false);
  assert.ok(ignored.hint);
  const done = rc.update(frame(172));
  // 深蹲下探帧被忽略，本次不应判为完成
  assert.strictEqual(done.repCompleted, false);
});

test('evaluateRep：置信度过低 → inconclusive，不产生纠正（Property 6）', () => {
  const analysis = evaluateRep(
    'squat',
    frame(170, { frame: { meanConfidence: 0.3 } }),
    { bottomPrimary: 100, bottomTorsoLean: 10, bottomAngles: { l_knee: 100, r_knee: 100 }, complete: true }
  );
  assert.strictEqual(analysis.status, 'inconclusive');
  assert.strictEqual(analysis.isStandard, false);
  assert.deepStrictEqual(analysis.problemAreas, []);
});

test('severity 分档映射', () => {
  assert.strictEqual(severityFromDeviation(5, [10, 20, 30]), 'none');
  assert.strictEqual(severityFromDeviation(15, [10, 20, 30]), 'low');
  assert.strictEqual(severityFromDeviation(25, [10, 20, 30]), 'medium');
  assert.strictEqual(severityFromDeviation(40, [10, 20, 30]), 'high');
});

test('evaluateRep：不标准 + conclusive 必有问题部位（Property 6 一致性）', () => {
  const rep = {
    bottomPrimary: 130,
    bottomTorsoLean: 70,
    bottomAngles: { l_knee: 130, r_knee: 100 },
    complete: true,
  };
  const analysis = evaluateRep('squat', frame(160), rep);
  assert.strictEqual(analysis.isStandard, false);
  assert.ok(analysis.problemAreas.length >= 2); // shallow_depth + back_rounding + hip_shift
});
