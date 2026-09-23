/**
 * 拟人化鼓励文案（移植原需求 8 的 Encouragement_Provider 模板兜底版）。
 * 触发器（原需求 8.1）：完成一组 / 组内最后一次 / 连续三次标准 / 结束训练。
 * 用计数轮转选择文案：确定性，无随机数，可测试。
 */

const BANKS = {
  set_done: ['一组完成，辛苦了！', '稳稳完成一组，状态不错！', '这组很扎实，休息一下继续！'],
  last_rep: ['最后一个，顶住！', '就是现在，最后一下！', '收尾这下最关键，完成它！'],
  streak_standard: ['连续三次标准动作，进步看得见！', '动作越来越稳了，继续保持！', '这个稳定性，给你点赞！'],
  session_end: ['今天练完了，做得漂亮！', '完成训练，给自己鼓个掌！', '又向目标前进了一步，明天见！'],
  resume: ['欢迎回来，我们继续！', '节奏还在，接着来！'],
};

/**
 * @param {keyof typeof BANKS} trigger
 * @param {number} counter 该触发器已触发次数（从 0 开始）
 * @returns {string}
 */
function pickEncouragement(trigger, counter) {
  const bank = BANKS[trigger] || BANKS.set_done;
  const idx = ((counter % bank.length) + bank.length) % bank.length;
  return bank[idx];
}

module.exports = { BANKS, pickEncouragement };
