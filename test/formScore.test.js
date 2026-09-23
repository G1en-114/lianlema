const test = require('node:test');
const assert = require('node:assert');
const { buildReport, withCorrectionText } = require('../miniprogram/core/formScore');

const std = (areas = []) => ({ isStandard: true, status: 'conclusive', problemAreas: areas, correctionText: null });
const bad = (areas) => ({ isStandard: false, status: 'conclusive', problemAreas: areas, correctionText: '纠正' });

test('空结果 → 动作分 0（Property 7 边界）', () => {
  const r = buildReport([]);
  assert.strictEqual(r.formScore, 0);
  assert.strictEqual(r.correctionCount, 0);
});

test('全标准 → 100；全不标准 → 0（Property 7）', () => {
  assert.strictEqual(buildReport([std(), std()]).formScore, 100);
  assert.strictEqual(buildReport([bad([{ area: 'x', severity: 'low' }])]).formScore, 0);
});

test('标准占比正确映射', () => {
  const r = buildReport([std(), std(), bad([{ area: 'x', severity: 'low' }]), std()]);
  assert.strictEqual(r.formScore, 75);
});

test('inconclusive 不计分、不计数（Property 6）', () => {
  const r = buildReport([{ isStandard: false, status: 'inconclusive', problemAreas: [], correctionText: null }]);
  assert.strictEqual(r.formScore, 0);
  assert.strictEqual(r.correctionCount, 0);
});

test('纠正次数 = 非标准且有纠正文本的次数（Property 8）', () => {
  const r = buildReport([
    std(),
    bad([{ area: 'knee_valgus', severity: 'low' }]),
    bad([{ area: 'knee_valgus', severity: 'low' }]),
    bad([{ area: 'back_rounding', severity: 'low' }]),
  ]);
  assert.strictEqual(r.correctionCount, 3);
});

test('下次重点 = 最高频问题部位', () => {
  const r = buildReport([
    bad([{ area: 'knee_valgus', severity: 'low' }]),
    bad([{ area: 'back_rounding', severity: 'low' }]),
    bad([{ area: 'back_rounding', severity: 'low' }]),
  ]);
  assert.ok(r.nextFocus.includes('back_rounding'));
  assert.ok(r.riskNotes[0].includes('不构成医疗建议'));
});

test('withCorrectionText：不标准必给纠正文本；标准给正反馈；inconclusive 不生成（Property 6）', () => {
  const badResult = withCorrectionText({ exercise: 'squat', isStandard: false, status: 'conclusive', problemAreas: [{ area: 'knee_valgus', severity: 'low' }] });
  assert.ok(badResult.correctionText.includes('膝盖'));

  const okResult = withCorrectionText({ exercise: 'squat', isStandard: true, status: 'conclusive', problemAreas: [] });
  assert.ok(okResult.correctionText.length > 0);

  const inc = withCorrectionText({ exercise: 'squat', isStandard: false, status: 'inconclusive', problemAreas: [] });
  assert.strictEqual(inc.correctionText, null);
});
