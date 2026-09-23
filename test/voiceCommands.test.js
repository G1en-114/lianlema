const test = require('node:test');
const assert = require('node:assert');
const { matchCommand } = require('../miniprogram/core/voiceCommands');

test('六个封闭意图均可命中（Property 10）', () => {
  const cases = {
    暂停一下: 'pause',
    继续: 'resume',
    换一个动作: 'switch_exercise',
    太难了降低难度: 'reduce_difficulty',
    再说一遍: 'repeat',
    结束训练: 'end_session',
  };
  for (const [text, expected] of Object.entries(cases)) {
    assert.strictEqual(matchCommand(text), expected, `"${text}" 应命中 ${expected}`);
  }
});

test('未匹配返回 null（调用方不得产生副作用）', () => {
  assert.strictEqual(matchCommand('今天天气不错'), null);
  assert.strictEqual(matchCommand(''), null);
  assert.strictEqual(matchCommand(null), null);
});

test('长关键词优先（降低难度 优先于 难）', () => {
  assert.strictEqual(matchCommand('这个降低难度一点'), 'reduce_difficulty');
  assert.strictEqual(matchCommand('结束'), 'end_session');
});
