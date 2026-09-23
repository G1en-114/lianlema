/**
 * 云端模型服务 Provider（天猫黑客松「小练 Daily」AI 服务版）。
 * 对接 backend 模型服务（backend/app/api/routes/model_service.py）：
 *   POST /api/vision/analyze  云端动作分析（ST-GCN/VLM）
 *   POST /api/coach/chat      LLM 教练对话（模板兜底）
 *   POST /api/plan/explain    计划个性化解释
 *   GET  /api/tiers           套餐目录   GET /api/status 能力状态
 *
 * 设计约定：
 * - MODEL_SERVICE_BASE_URL 留空 = 未连接（available()=false），所有 UI 自动隐藏云端入口。
 * - 请求失败静默降级（reject 带 fallback=true），调用方回退本地模板，绝不阻断训练主链路。
 * - toCoco17：端侧 body-18 关键点 → COCO-17 重排（纯函数，Node 可测）。
 */
const config = require('../../config');

// body-18（COCO+neck 布局，同 core/poseRules.KEYPOINT_INDEX）→ COCO-17 下标；
// -1 表示无对应点（眼部/耳部，填 0）。
const B18_TO_COCO17 = [0, -1, -1, -1, -1, 5, 2, 6, 3, 7, 4, 11, 8, 12, 9, 13, 10];

/** @returns {number[][]} COCO-17 一帧 [17][2] */
function toCoco17(points) {
  const out = [];
  for (let i = 0; i < 17; i++) {
    const src = B18_TO_COCO17[i];
    if (src < 0 || !points[src]) out.push([0, 0]);
    else out.push([Number(points[src].x) || 0, Number(points[src].y) || 0]);
  }
  return out;
}

function fallbackError(reason) {
  const err = new Error(reason);
  err.fallback = true;
  return err;
}

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    if (!config.MODEL_SERVICE_BASE_URL) {
      reject(fallbackError('model-service-not-configured'));
      return;
    }
    wx.request({
      url: config.MODEL_SERVICE_BASE_URL.replace(/\/+$/, '') + path,
      method,
      data,
      header: {
        'content-type': 'application/json',
        'X-API-Key': config.MODEL_SERVICE_API_KEY || '',
      },
      timeout: 15000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject(fallbackError(`http-${res.statusCode}`));
      },
      fail: (e) => reject(fallbackError((e && e.errMsg) || 'network-error')),
    });
  });
}

const modelService = {
  /** 是否已连接云端模型服务（config.MODEL_SERVICE_BASE_URL 非空）。 */
  available() {
    return !!config.MODEL_SERVICE_BASE_URL;
  },

  status() {
    return request('GET', '/api/status');
  },

  tiers() {
    return request('GET', '/api/tiers');
  },

  /** @param {{exercise?:string, frames:number[][][], imageBase64?:string}} opts */
  analyze(opts) {
    return request('POST', '/api/vision/analyze', {
      exercise: (opts && opts.exercise) || null,
      frames: (opts && opts.frames) || [],
      image_base64: (opts && opts.imageBase64) || null,
    });
  },

  /** @param {Array<{role:string,content:string}>} messages */
  chat(messages, context) {
    return request('POST', '/api/coach/chat', { messages, context: context || {} });
  },

  planExplain(planSummary, assessment) {
    return request('POST', '/api/plan/explain', {
      plan_summary: planSummary || '',
      assessment: assessment || null,
    });
  },
};

module.exports = { modelService, toCoco17 };
