/**
 * 7 天计划生成（移植自 app/src/domain/planGenerator.ts，镜像后端 plan_generator.py）。
 * 确定性纯函数：同输入必同输出；无 LLM、无 I/O（设计红线 P4）。
 */
const { availableExercises, regressionNoteFor } = require('./catalog');

const PLAN_DAYS = 7;

/** @typedef {'fat_loss'|'muscle_gain'|'endurance'|'general_fitness'} TrainingGoal */

/**
 * 目标处方：组数/每组次数/组间休息/难度/每日动作数。
 * @type {Record<TrainingGoal, {sets:number,reps:number,restSec:number,difficulty:number,perDay:number}>}
 */
const GOAL_PRESCRIPTION = {
  fat_loss: { sets: 3, reps: 15, restSec: 30, difficulty: 3, perDay: 4 },
  muscle_gain: { sets: 4, reps: 10, restSec: 75, difficulty: 4, perDay: 3 },
  endurance: { sets: 3, reps: 20, restSec: 30, difficulty: 2, perDay: 4 },
  general_fitness: { sets: 3, reps: 12, restSec: 60, difficulty: 3, perDay: 3 },
};

/**
 * 在 1..7 中尽量均匀选出 weeklyFrequency 个训练日（确定性）。
 * @param {number} weeklyFrequency
 * @returns {Set<number>}
 */
function trainingDayIndices(weeklyFrequency) {
  if (weeklyFrequency >= PLAN_DAYS) {
    return new Set([1, 2, 3, 4, 5, 6, 7]);
  }
  const indices = new Set();
  for (let i = 0; i < weeklyFrequency; i++) {
    let day = Math.round(1 + (i * (PLAN_DAYS - 1)) / Math.max(weeklyFrequency - 1, 1));
    while (indices.has(day)) {
      day = (day % PLAN_DAYS) + 1;
    }
    indices.add(day);
  }
  return indices;
}

/**
 * @param {import('./catalog').ExerciseDef[]} pool
 * @param {{sets:number,reps:number,restSec:number,difficulty:number,perDay:number}} rx
 * @param {number} dayOffset
 * @param {import('./catalog').InjuryRiskArea[]} mildRisks
 * @returns {Array<{name:string,exercise:import('./catalog').SupportedExercise|null,sets:number,reps:number,restSec:number,difficulty:number,regressionNote:string|null}>}
 */
function buildExercises(pool, rx, dayOffset, mildRisks) {
  if (pool.length === 0) return [];
  const perDay = Math.min(rx.perDay, pool.length);
  const chosen = [];
  for (let j = 0; j < perDay; j++) {
    const ex = pool[(dayOffset + j) % pool.length];
    if (!ex) continue;
    chosen.push({
      name: ex.name,
      exercise: ex.supported,
      sets: rx.sets,
      reps: rx.reps,
      restSec: rx.restSec,
      difficulty: rx.difficulty,
      regressionNote: regressionNoteFor(ex, mildRisks),
    });
  }
  return chosen;
}

/**
 * @param {{goal:TrainingGoal, equipment:import('./catalog').Equipment[], weeklyFrequency:number, injuryLevels:Object}} assessment
 * @returns {{days:Array<{dayIndex:number,isRestDay:boolean,exercises:any[]}>}}
 */
function generatePlan(assessment) {
  const rx = GOAL_PRESCRIPTION[assessment.goal];
  const levels = assessment.injuryLevels || {};
  const severeRisks = Object.keys(levels).filter((k) => levels[k] === 'severe');
  const mildRisks = Object.keys(levels).filter((k) => levels[k] === 'mild');
  const pool = availableExercises(assessment.equipment, severeRisks);
  const trainingDays = trainingDayIndices(assessment.weeklyFrequency);

  const days = [];
  let trainingSeen = 0;
  for (let dayIndex = 1; dayIndex <= PLAN_DAYS; dayIndex++) {
    if (trainingDays.has(dayIndex)) {
      days.push({
        dayIndex,
        isRestDay: false,
        exercises: buildExercises(pool, rx, trainingSeen, mildRisks),
      });
      trainingSeen += 1;
    } else {
      days.push({ dayIndex, isRestDay: true, exercises: [] });
    }
  }
  return { days };
}

module.exports = { PLAN_DAYS, GOAL_PRESCRIPTION, trainingDayIndices, generatePlan };
