/**
 * 云函数：llmcoach —— 教练文案 AI 润色（可选，正式版可提审的普通云函数）。
 *
 * 流程：模板文案 → 腾讯云混元润色表达 → msgSecCheck 内容安全检查 → 返回。
 * 任一步失败 → { ok:false }，客户端沿用模板文案（永不阻断训练）。
 *
 * 安全与合规：
 * - 密钥仅从云函数环境变量读取（HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY），不入代码与日志；
 * - 提示词约束：不改数字/事实、不新增动作判定、输出 ≤40 字纯文本；
 * - 输出经 security.msgSecCheck 通过才返回（微信平台运营规范要求的内容安全能力）。
 *
 * 部署：见 README《启用 AI 文案润色》。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const SCENE_PROMPTS = {
  encourage:
    '你是健身教练"小练"。请把下面这句教练鼓励改写得更有温度、更口语化，保持原意和其中的数字事实，不超过40个字，只输出改写后的句子。',
  correction:
    '你是健身教练"小练"。请把下面这句动作纠正提示改写得更易懂、更鼓励人，不得改变纠正要点和数字事实，不超过40个字，只输出改写后的句子。',
  summary:
    '你是健身教练"小练"。请把下面这段训练小结改写得更亲切自然，保持所有数字与结论不变，不超过60个字，只输出改写后的段落。',
};

function extractText(hunyuanRes) {
  // 兼容混元 OpenAPI 的多种返回形态，取第一个非空文本。
  try {
    const choices = hunyuanRes && hunyuanRes.Choices;
    if (Array.isArray(choices) && choices[0]) {
      const c = choices[0];
      const content = (c.Message && c.Message.Content) || c.Delta && c.Delta.Content;
      if (typeof content === 'string') return content.trim();
    }
  } catch (e) {
    /* fallthrough */
  }
  return null;
}

async function callHunyuan(text, scene) {
  const tencentcloud = require('tencentcloud-sdk-nodejs-hunyuan');
  const Client = tencentcloud.hunyuan.v20230901.Client;
  const client = new Client({
    credential: {
      secretId: process.env.HUNYUAN_SECRET_ID,
      secretKey: process.env.HUNYUAN_SECRET_KEY,
    },
    region: process.env.HUNYUAN_REGION || 'ap-guangzhou',
  });
  const res = await client.ChatCompletions({
    Model: process.env.HUNYUAN_MODEL || 'hunyuan-lite',
    Messages: [
      { Role: 'system', Content: SCENE_PROMPTS[scene] || SCENE_PROMPTS.encourage },
      { Role: 'user', Content: text },
    ],
    MaxTokens: 120,
    Temperature: 0.7,
  });
  return extractText(res);
}

exports.main = async (event) => {
  const text = event && typeof event.text === 'string' ? event.text.slice(0, 200) : '';
  const scene = SCENE_PROMPTS[event && event.scene] ? event.scene : 'encourage';
  if (!text) return { ok: false, reason: 'empty' };

  try {
    const polished = await callHunyuan(text, scene);
    if (!polished || polished.length === 0 || polished.length > 120) {
      return { ok: false, reason: 'polish_failed' };
    }

    // 内容安全检查（输出将展示给用户）：不通过则回退模板。
    try {
      const sec = await cloud.openapi.security.msgSecCheck({
        version: 2,
        scene: 2,
        content: polished,
      });
      if (sec && sec.result && sec.result.suggest && sec.result.suggest !== 'pass') {
        return { ok: false, reason: 'sec_check' };
      }
    } catch (e) {
      // 检查能力不可用（如未开通）时不放行 AI 文本，保守回退模板。
      return { ok: false, reason: 'sec_check_unavailable' };
    }

    return { ok: true, text: polished };
  } catch (e) {
    console.warn('[llmcoach] failed:', e && e.message);
    return { ok: false, reason: 'error' };
  }
};
