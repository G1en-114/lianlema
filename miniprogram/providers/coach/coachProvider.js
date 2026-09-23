/**
 * AI 教练文案 Provider（微信 AI 生态：云开发大模型润色，模板兜底）。
 *
 * 设计对齐原项目 Coach_Text：
 * - LLM 只润色"表达"，不改数值、不改事实、不做动作判定（确定性红线）。
 * - 任何失败（未开启/无云环境/超时/内容安全拦截）→ 原样返回模板文本，永不阻断训练。
 * - 输出经云端 msgSecCheck 内容安全检查后才返回（平台运营规范）。
 */
const config = require('../../config');

function available() {
  return !!config.ENABLE_AI_TEXT && config.CLOUD_ENV_ID && typeof wx !== 'undefined' && !!wx.cloud;
}

/**
 * 润色教练文案。失败或未开启时返回原文。
 * @param {string} text 模板文案（事实来源，不可被改写数值）
 * @param {{scene:'encourage'|'correction'|'summary'}} context
 * @returns {Promise<string>}
 */
async function polish(text, context) {
  if (!available() || !text) return text;
  try {
    const res = await wx.cloud.callFunction({
      name: 'llmcoach',
      data: { text, scene: (context && context.scene) || 'encourage' },
    });
    const result = res && res.result;
    if (result && result.ok && typeof result.text === 'string' && result.text.length > 0) {
      return result.text;
    }
    return text;
  } catch (e) {
    return text;
  }
}

module.exports = { polish, available };
