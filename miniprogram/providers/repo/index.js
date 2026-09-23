/**
 * 仓库层入口：根据 config.CLOUD_ENV_ID 选择云端或本地，云端初始化失败自动降级本地。
 * 业务代码只依赖 getRepo()，不感知差异（对齐原 Form_Analysis_Provider 的契约思想）。
 */
const config = require('../../config');
const localRepo = require('./localRepo');

let current = localRepo;

/** app.js onLaunch 时 await 调用。 @returns {Promise<{mode:'local'|'cloud'}>} */
async function initRepo() {
  if (config.CLOUD_ENV_ID && typeof wx !== 'undefined' && wx.cloud) {
    const cloudRepo = require('./cloudRepo');
    current = await cloudRepo.init(config.CLOUD_ENV_ID);
  } else {
    current = localRepo;
  }
  return { mode: current.mode };
}

function getRepo() {
  return current || localRepo;
}

module.exports = { initRepo, getRepo };
