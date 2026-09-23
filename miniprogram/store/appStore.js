/**
 * 全局应用状态（移植自 app/src/store/useAppStore.ts，zustand → 轻量发布订阅）。
 * 管理评估输入、计划、权益、会话内分析累计与报告。
 */
const { generatePlan } = require('../core/planGenerator');
const { buildReport } = require('../core/formScore');
const entitlement = require('../core/entitlement');

const state = {
  assessment: null,
  plan: null,
  entitlement: entitlement.newEntitlement(),
  consent: { sensitiveHealth: false },
  sessions: [], // 训练历史，时间倒序
  analyses: [], // 当前会话累计的动作分析
  report: null, // 当前会话报告
};

const listeners = new Set();

function getState() {
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

function setState(partial) {
  Object.assign(state, partial);
  emit();
}

/** 启动时从仓库层恢复（app.js onLaunch 调用，repo 已初始化）。兼容同步（本地）与异步（云端）仓库。 */
async function hydrate() {
  const repo = require('../providers/repo/index').getRepo();
  const [assessment, entitlementSaved, consent, sessions] = await Promise.all([
    repo.getAssessment(),
    repo.getEntitlement(),
    repo.getConsent(),
    repo.getSessions(),
  ]);
  setState({
    assessment,
    plan: assessment ? await repo.getPlan() : null,
    entitlement: entitlementSaved || entitlement.newEntitlement(),
    consent: consent || { sensitiveHealth: false },
    sessions: sessions || [],
    analyses: [],
    report: null,
  });
}

/** 提交评估：立即生成计划并持久化（确定性纯函数，无 LLM）。 */
function submitAssessment(assessment) {
  const withTime = { ...assessment, createdAt: assessment.createdAt || new Date().toISOString() };
  const plan = generatePlan(withTime);
  const repo = require('../providers/repo/index').getRepo();
  repo.saveAssessment(withTime);
  repo.savePlan(plan);
  setState({ assessment: withTime, plan, report: null, analyses: [] });
}

function startSession() {
  const repo = require('../providers/repo/index').getRepo();
  const ent = entitlement.consumeQuota(state.entitlement);
  repo.saveEntitlement(ent);
  setState({ entitlement: ent, analyses: [], report: null });
}

function recordAnalysis(result) {
  setState({ analyses: [...state.analyses, result] });
}

/** 结束会话：确定性生成报告并写入历史（倒序）。兼容同步（本地）与异步（云端）仓库。 */
async function finishSession(meta) {
  const report = buildReport(state.analyses);
  const record = {
    id: `s_${Date.now()}`,
    startedAt: meta && meta.startedAt,
    endedAt: new Date().toISOString(),
    totalReps: state.analyses.length,
    report,
  };
  const repo = require('../providers/repo/index').getRepo();
  await repo.saveSession(record);
  const sessions = await repo.getSessions();
  setState({ report, sessions });
  return report;
}

/** 撤回敏感健康信息同意：立即清空伤痛分级并按现约束重新生成计划。 */
function revokeSensitiveConsent() {
  const repo = require('../providers/repo/index').getRepo();
  repo.saveConsent({ sensitiveHealth: false });
  const cleared = state.assessment
    ? { ...state.assessment, injuryLevels: {}, sensitiveConsent: false }
    : null;
  let plan = state.plan;
  if (cleared) {
    plan = generatePlan(cleared);
    repo.saveAssessment(cleared);
    repo.savePlan(plan);
  }
  setState({ consent: { sensitiveHealth: false }, assessment: cleared, plan });
}

function resetAll() {
  const repo = require('../providers/repo/index').getRepo();
  repo.clearAll();
  setState({
    assessment: null,
    plan: null,
    entitlement: entitlement.newEntitlement(),
    consent: { sensitiveHealth: false },
    sessions: [],
    analyses: [],
    report: null,
  });
}

module.exports = {
  getState,
  setState,
  subscribe,
  hydrate,
  submitAssessment,
  startSession,
  recordAnalysis,
  finishSession,
  revokeSensitiveConsent,
  resetAll,
};
