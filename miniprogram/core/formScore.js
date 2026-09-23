/**
 * 训练报告计算（移植自 app/src/store/useAppStore.ts 的 buildReport，镜像后端 form_score/next_focus）。
 * 确定性纯函数：动作分/纠正次数/风险提示/下次重点绝不由 LLM 生成（设计红线 P4/P7/P8）。
 */
const { composeCorrection } = require('./corrections');

/**
 * @param {Array<{isStandard:boolean, status:'conclusive'|'inconclusive', correctionText:string|null, problemAreas:Array<{area:string,severity:string}>}>} analyses
 * @returns {{formScore:number, riskNotes:string[], correctionCount:number, nextFocus:string, summaryText:string|null}}
 */
function buildReport(analyses) {
  const conclusive = analyses.filter((a) => a.status === 'conclusive');
  const standardCount = conclusive.filter((a) => a.isStandard).length;
  const formScore =
    conclusive.length === 0 ? 0 : Math.round((standardCount / conclusive.length) * 100);

  const corrections = conclusive.filter((a) => !a.isStandard && a.correctionText);
  const correctionCount = corrections.length;

  // 统计最高频问题部位作为"下一次重点"。
  const areaFreq = new Map();
  for (const a of conclusive) {
    for (const p of a.problemAreas || []) {
      areaFreq.set(p.area, (areaFreq.get(p.area) || 0) + 1);
    }
  }
  let topArea = null;
  let topCount = 0;
  for (const [area, count] of areaFreq) {
    if (count > topCount) {
      topArea = area;
      topCount = count;
    }
  }

  const riskNotes = topArea
    ? [`本次「${topArea}」问题出现较多，注意相关部位（不构成医疗建议）。`]
    : ['本次未发现明显风险点（不构成医疗建议）。'];
  const nextFocus = topArea
    ? `下次重点改善「${topArea}」相关动作质量。`
    : '下次保持当前动作质量，可适度提升强度。';

  const summaryText =
    conclusive.length === 0
      ? '本次没有采集到有效动作帧，下次请让全身保持在画面内。'
      : `共完成 ${conclusive.length} 次动作评估，标准率 ${formScore}%。`;

  return { formScore, riskNotes, correctionCount, nextFocus, summaryText };
}

/** 由单条分析结果补全纠正文本（保持 isStandard 判定不变，仅生成解释性文本）。 */
function withCorrectionText(analysis) {
  const correctionText =
    !analysis.isStandard && analysis.status === 'conclusive'
      ? composeCorrection(analysis.problemAreas)
      : analysis.isStandard
        ? '动作到位，保持这个感觉！'
        : null;
  return { ...analysis, correctionText };
}

module.exports = { buildReport, withCorrectionText };
