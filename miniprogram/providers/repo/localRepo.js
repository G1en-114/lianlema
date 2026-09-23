/**
 * 本地仓库（默认模式）：wx.setStorageSync 持久化。无 wx 环境时降级为内存（便于测试）。
 * 训练数据仅保存在用户手机本地（对应《用户隐私保护指引》声明）。
 */

const KEYS = {
  assessment: 'llm_assessment',
  plan: 'llm_plan',
  entitlement: 'llm_entitlement',
  sessions: 'llm_sessions',
  consent: 'llm_consent',
};

const memory = {};
const hasWx = typeof wx !== 'undefined' && wx.setStorageSync;

function read(key, fallback) {
  try {
    const v = hasWx ? wx.getStorageSync(key) : memory[key];
    return v === '' || v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (hasWx) wx.setStorageSync(key, value);
    else memory[key] = value;
  } catch (e) {
    /* 存储失败时保持内存态，不阻断训练流程 */
  }
}

function remove(key) {
  try {
    if (hasWx) wx.removeStorageSync(key);
    else delete memory[key];
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  mode: 'local',
  getAssessment: () => read(KEYS.assessment, null),
  saveAssessment: (a) => write(KEYS.assessment, a),
  getPlan: () => read(KEYS.plan, null),
  savePlan: (p) => write(KEYS.plan, p),
  getEntitlement: () => read(KEYS.entitlement, null),
  saveEntitlement: (e) => write(KEYS.entitlement, e),
  getConsent: () => read(KEYS.consent, null),
  saveConsent: (c) => write(KEYS.consent, c),
  getSessions: () => read(KEYS.sessions, []),
  saveSession(record) {
    const list = read(KEYS.sessions, []);
    list.unshift(record);
    write(KEYS.sessions, list.slice(0, 200));
  },
  clearAll() {
    Object.values(KEYS).forEach(remove);
  },
};
