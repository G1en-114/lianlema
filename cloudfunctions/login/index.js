/**
 * 可选云函数：login（获取 openid）。
 * 仅在启用云开发时有意义（见 README《启用云开发》）；不启用可整个删除 cloudfunctions/ 目录。
 * 用途：云端身份标识，为后续多端数据同步/权益服务端化预留。
 */
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID, APPID, UNIONID } = cloud.getWXContext();
  return { openid: OPENID, appid: APPID, unionid: UNIONID || null };
};
