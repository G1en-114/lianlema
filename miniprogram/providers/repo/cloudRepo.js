/**
 * 云开发仓库（可选模式）：需在 config.js 配置 CLOUD_ENV_ID 并开通云开发。
 * 集合默认权限"仅创建者可读写"，_openid 由云端自动写入，天然免登录。
 * 任一云调用失败 → 全局降级 localRepo（一次性），保证功能永不变砖。
 */
const localRepo = require('./localRepo');

const COLLECTIONS = {
  assessment: 'assessments',
  plan: 'plans',
  entitlement: 'entitlements',
  consent: 'consents',
  session: 'sessions',
};

let db = null;
let degraded = false;

function handleFailure(e) {
  if (!degraded) {
    degraded = true;
    console.warn('[cloudRepo] 云端不可用，已降级本地模式：', e && e.errMsg);
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({ title: '云端不可用，已切换本地模式', icon: 'none' });
    }
  }
}

function col(name) {
  return db.collection(COLLECTIONS[name]);
}

/** 单文档 upsert（评估/计划/权益/同意各一条）。 */
async function upsertOne(name, data) {
  if (degraded) return localRepo;
  try {
    const res = await col(name).where({}).limit(1).get();
    if (res.data && res.data.length > 0) {
      await col(name).doc(res.data[0]._id).update({ data });
    } else {
      await col(name).add({ data });
    }
    return true;
  } catch (e) {
    handleFailure(e);
    return false;
  }
}

async function getOne(name, fallback) {
  if (degraded) return fallback;
  try {
    const res = await col(name).where({}).limit(1).get();
    return res.data && res.data.length > 0 ? res.data[0] : fallback;
  } catch (e) {
    handleFailure(e);
    return fallback;
  }
}

const cloudRepo = {
  mode: 'cloud',
  /** 初始化；返回可用的仓库实现（失败则 localRepo）。 */
  async init(envId) {
    try {
      wx.cloud.init({ env: envId, traceUser: true });
      db = wx.cloud.database();
      await db.collection(COLLECTIONS.session).count();
      return cloudRepo;
    } catch (e) {
      handleFailure(e);
      return localRepo;
    }
  },

  getAssessment: () => getOne('assessment', null),
  saveAssessment: (a) => upsertOne('assessment', a),
  getPlan: () => getOne('plan', null),
  savePlan: (p) => upsertOne('plan', p),
  getEntitlement: () => getOne('entitlement', null),
  saveEntitlement: (e) => upsertOne('entitlement', e),
  getConsent: () => getOne('consent', null),
  saveConsent: (c) => upsertOne('consent', c),

  async getSessions() {
    if (degraded) return localRepo.getSessions();
    try {
      const res = await col('session').orderBy('startedAt', 'desc').limit(50).get();
      return (res.data || []).map((d) => ({
        id: d._id,
        startedAt: d.startedAt,
        endedAt: d.endedAt,
        totalReps: d.totalReps,
        report: d.report,
      }));
    } catch (e) {
      handleFailure(e);
      return localRepo.getSessions();
    }
  },

  async saveSession(record) {
    if (degraded) return localRepo.saveSession(record);
    try {
      await col('session').add({ data: record });
      return true;
    } catch (e) {
      handleFailure(e);
      return localRepo.saveSession(record);
    }
  },

  async clearAll() {
    if (degraded) return localRepo.clearAll();
    let ok = true;
    for (const name of Object.keys(COLLECTIONS)) {
      try {
        const res = await col(name).where({}).limit(100).get();
        for (const doc of res.data || []) {
          await col(name).doc(doc._id).remove();
        }
      } catch (e) {
        ok = false; // 单个集合失败忽略，继续清理其余
      }
    }
    if (!ok) localRepo.clearAll();
    return true;
  },
};

module.exports = cloudRepo;
