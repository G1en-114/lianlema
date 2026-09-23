/**
 * 动作库（移植自 backend/app/deterministic/exercise_catalog.py 与 app/src/domain/catalog.ts）。
 * 纯数据 + 纯函数，无副作用，可在 Node 环境直接测试。
 *
 * - requiredEquipment：所需器械，空数组 = 徒手（任何场地可做）。
 * - loads：显著加载的身体部位（用于伤痛规避/降阶提示）。
 * - supported：可纠错动作枚举（仅四个首版支持动作有值）。
 */

/** @typedef {'none'|'dumbbell'|'barbell'|'resistance_band'|'bench'} Equipment */
/** @typedef {'shoulder'|'lower_back'|'knee'|'wrist'|'neck'} InjuryRiskArea */
/** @typedef {'squat'|'lunge'|'overhead_press'|'push_up'} SupportedExercise */

/** @typedef {{name: string, requiredEquipment: Equipment[], loads: InjuryRiskArea[], supported: SupportedExercise|null}} ExerciseDef */

const CATALOG = [
  { name: '深蹲', requiredEquipment: [], loads: ['knee'], supported: 'squat' },
  { name: '弓步蹲', requiredEquipment: [], loads: ['knee'], supported: 'lunge' },
  { name: '俯卧撑', requiredEquipment: [], loads: ['shoulder', 'wrist'], supported: 'push_up' },
  { name: '站姿推举', requiredEquipment: ['dumbbell'], loads: ['shoulder'], supported: 'overhead_press' },
  { name: '平板支撑', requiredEquipment: [], loads: [], supported: null },
  { name: '臀桥', requiredEquipment: [], loads: [], supported: null },
  { name: '开合跳', requiredEquipment: [], loads: ['knee'], supported: null },
  { name: '哑铃划船', requiredEquipment: ['dumbbell'], loads: ['lower_back'], supported: null },
  { name: '杠铃硬拉', requiredEquipment: ['barbell'], loads: ['lower_back'], supported: null },
  { name: '弹力带划船', requiredEquipment: ['resistance_band'], loads: [], supported: null },
];

const AREA_LABELS = {
  shoulder: '肩部',
  lower_back: '腰背',
  knee: '膝盖',
  wrist: '手腕',
  neck: '颈部',
};

/**
 * 返回与器械相容、且不加载 severe 伤痛部位的动作列表。
 * （原需求 2.4/2.5：器械相容 + severe 规避；mild 在计划生成时附降阶提示。）
 * @param {Equipment[]} equipment
 * @param {InjuryRiskArea[]} severeRisks
 * @returns {ExerciseDef[]}
 */
function availableExercises(equipment, severeRisks) {
  const owned = new Set(equipment);
  const risks = new Set(severeRisks);
  return CATALOG.filter((ex) => {
    const equipOk = ex.requiredEquipment.every((e) => owned.has(e));
    const riskOk = !ex.loads.some((l) => risks.has(l));
    return equipOk && riskOk;
  });
}

/**
 * mild 伤痛部位的降阶提示（原需求 3.6：mild 提供降阶替代提示）。
 * @param {ExerciseDef} ex
 * @param {InjuryRiskArea[]} mildRisks
 * @returns {string|null}
 */
function regressionNoteFor(ex, mildRisks) {
  const hit = ex.loads.filter((l) => mildRisks.includes(l));
  if (hit.length === 0) return null;
  const labels = hit.map((l) => AREA_LABELS[l]);
  return `轻度涉及${labels.join('、')}：降低动作幅度与速度，出现疼痛立即停止。`;
}

module.exports = { CATALOG, AREA_LABELS, availableExercises, regressionNoteFor };
