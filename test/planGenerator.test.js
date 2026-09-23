const test = require('node:test');
const assert = require('node:assert');
const { generatePlan, PLAN_DAYS } = require('../miniprogram/core/planGenerator');
const { CATALOG } = require('../miniprogram/core/catalog');

function assessment(overrides = {}) {
  return {
    goal: 'general_fitness',
    venue: 'home',
    equipment: ['none'],
    weeklyFrequency: 3,
    injuryLevels: {},
    ...overrides,
  };
}

test('计划恰好覆盖 7 天（Property 2）', () => {
  const plan = generatePlan(assessment());
  assert.strictEqual(plan.days.length, PLAN_DAYS);
  assert.deepStrictEqual(plan.days.map((d) => d.dayIndex), [1, 2, 3, 4, 5, 6, 7]);
});

for (let freq = 1; freq <= 7; freq++) {
  test(`频率 ${freq} → 训练日数 = ${freq}（Property 2）`, () => {
    const plan = generatePlan(assessment({ weeklyFrequency: freq }));
    const trainingDays = plan.days.filter((d) => !d.isRestDay);
    assert.strictEqual(trainingDays.length, freq);
  });
}

test('器械相容：无器械计划不出现需哑铃/杠铃/弹力带的动作', () => {
  const plan = generatePlan(assessment({ equipment: ['none'] }));
  const names = plan.days.flatMap((d) => d.exercises.map((e) => e.name));
  const forbidden = ['站姿推举', '哑铃划船', '杠铃硬拉', '弹力带划船'];
  for (const name of forbidden) {
    assert.ok(!names.includes(name), `不应出现 ${name}`);
  }
});

test('器械相容：有哑铃才可安排站姿推举', () => {
  const withDumbbell = generatePlan(assessment({ equipment: ['dumbbell'], weeklyFrequency: 7 }));
  const names = withDumbbell.days.flatMap((d) => d.exercises.map((e) => e.name));
  assert.ok(names.includes('站姿推举'));
});

test('severe 伤痛规避：膝盖 severe 计划不含深蹲/弓步蹲/开合跳（Property 3）', () => {
  const plan = generatePlan(assessment({ injuryLevels: { knee: 'severe' }, weeklyFrequency: 7 }));
  const names = plan.days.flatMap((d) => d.exercises.map((e) => e.name));
  for (const name of ['深蹲', '弓步蹲', '开合跳']) {
    assert.ok(!names.includes(name), `不应出现 ${name}`);
  }
});

test('mild 伤痛保留动作并附降阶提示', () => {
  const plan = generatePlan(assessment({ injuryLevels: { knee: 'mild' }, weeklyFrequency: 7 }));
  const squats = plan.days.flatMap((d) => d.exercises).filter((e) => e.name === '深蹲');
  assert.ok(squats.length > 0);
  for (const s of squats) {
    assert.ok(s.regressionNote && s.regressionNote.includes('膝盖'));
  }
});

test('确定性：同输入同输出（Property 4）', () => {
  const a = generatePlan(assessment({ weeklyFrequency: 4, equipment: ['dumbbell'] }));
  const b = generatePlan(assessment({ weeklyFrequency: 4, equipment: ['dumbbell'] }));
  assert.deepStrictEqual(a, b);
});

test('计划动作都来自动作目录', () => {
  const plan = generatePlan(assessment({ weeklyFrequency: 7, equipment: ['dumbbell', 'barbell', 'resistance_band', 'bench'] }));
  const known = new Set(CATALOG.map((c) => c.name));
  for (const ex of plan.days.flatMap((d) => d.exercises)) {
    assert.ok(known.has(ex.name), `${ex.name} 不在目录中`);
  }
});
