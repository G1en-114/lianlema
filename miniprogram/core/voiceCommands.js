/**
 * 语音命令意图映射（移植原需求 6 的封闭意图集）。
 * 纯函数：映射结果必为意图之一或 null；null 时调用方不得产生任何训练控制副作用（P10）。
 *
 * @typedef {'pause'|'resume'|'switch_exercise'|'reduce_difficulty'|'repeat'|'end_session'} VoiceCommand
 */

const COMMAND_KEYWORDS = [
  { command: 'pause', keywords: ['暂停', '停止', '停一下', '先停'] },
  { command: 'resume', keywords: ['继续', '开始', '接着练', '恢复'] },
  { command: 'switch_exercise', keywords: ['换动作', '下一个', '换一个', '下一个动作'] },
  { command: 'reduce_difficulty', keywords: ['降低难度', '太难了', '太累', '简单点', '减难度'] },
  { command: 'repeat', keywords: ['再说一遍', '重复', '再说一次', '没听清'] },
  { command: 'end_session', keywords: ['结束', '结束训练', '练完了', '完成训练', '收工'] },
];

/**
 * 将识别文本映射为受支持命令；未匹配返回 null（调用方不执行任何控制）。
 * 优先匹配更长关键词（"降低难度"先于"难度"）。
 * @param {string} text
 * @returns {VoiceCommand|null}
 */
function matchCommand(text) {
  if (!text) return null;
  const normalized = String(text).replace(/\s+/g, '');
  let best = null;
  let bestLen = 0;
  for (const entry of COMMAND_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (normalized.includes(kw) && kw.length > bestLen) {
        best = entry.command;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

const COMMAND_LABELS = {
  pause: '已暂停',
  resume: '继续训练',
  switch_exercise: '已切换动作',
  reduce_difficulty: '难度已降低',
  repeat: '再说一遍',
  end_session: '训练结束',
};

module.exports = { COMMAND_KEYWORDS, COMMAND_LABELS, matchCommand };
