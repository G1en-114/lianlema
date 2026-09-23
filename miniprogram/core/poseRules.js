/**
 * 姿态角度判定规则（移植模型层 src/score.py 的 cpt_angle/cpr_angle 思想到实时单目场景）。
 * 纯函数 + 纯状态机，Node 可测：输入关节角序列，输出计数与每 rep 的 FormAnalysis 结果。
 *
 * 关键点索引说明：
 * 微信 VisionKit body 检测输出 23 个 2D 关键点（官方文档以配图给出定义）。
 * 下面 KEYPOINT_INDEX 采用社区通行的 body-18 布局（COCO+neck），只使用 0..17；
 * 真机冒烟时请对照官方文档配图核对一次：
 * https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html
 * 若索引不一致，仅需修改本映射表，其余逻辑不动。
 */
const KEYPOINT_INDEX = {
  nose: 0,
  neck: 1,
  r_shoulder: 2,
  r_elbow: 3,
  r_wrist: 4,
  l_shoulder: 5,
  l_elbow: 6,
  l_wrist: 7,
  r_hip: 8,
  r_knee: 9,
  r_ankle: 10,
  l_hip: 11,
  l_knee: 12,
  l_ankle: 13,
};

/** 由两个向量计算夹角（度），对应 score.py vec_angle。 */
function vecAngle(a, b) {
  const dot = a.x * b.x + a.y * b.y;
  const na = Math.hypot(a.x, a.y);
  const nb = Math.hypot(b.x, b.y);
  if (na === 0 || nb === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (na * nb)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function sub(p, q) {
  return { x: p.x - q.x, y: p.y - q.y };
}

/**
 * 由一帧关键点计算 8 个关节角 + 躯干前倾角，对应 score.py cpt_angle。
 * @param {Array<{x:number,y:number}>} points
 * @param {number[]} [confidenceArr] 每点置信度（可选）
 * @returns {{angles:Object, meanConfidence:number, torsoLean:number}}
 */
function computeAngles(points, confidenceArr) {
  const K = KEYPOINT_INDEX;
  const p = (name) => points[K[name]] || { x: 0, y: 0 };
  const conf = (name) =>
    Array.isArray(confidenceArr) && confidenceArr[K[name]] != null ? confidenceArr[K[name]] : 1;

  const angles = {
    l_elbow: vecAngle(sub(p('l_shoulder'), p('l_elbow')), sub(p('l_wrist'), p('l_elbow'))),
    r_elbow: vecAngle(sub(p('r_shoulder'), p('r_elbow')), sub(p('r_wrist'), p('r_elbow'))),
    l_shoulder: vecAngle(sub(p('neck'), p('l_shoulder')), sub(p('l_elbow'), p('l_shoulder'))),
    r_shoulder: vecAngle(sub(p('neck'), p('r_shoulder')), sub(p('r_elbow'), p('r_shoulder'))),
    l_hip: vecAngle(sub(p('neck'), p('l_hip')), sub(p('l_knee'), p('l_hip'))),
    r_hip: vecAngle(sub(p('neck'), p('r_hip')), sub(p('r_knee'), p('r_hip'))),
    l_knee: vecAngle(sub(p('l_hip'), p('l_knee')), sub(p('l_ankle'), p('l_knee'))),
    r_knee: vecAngle(sub(p('r_hip'), p('r_knee')), sub(p('r_ankle'), p('r_knee'))),
  };

  // 躯干前倾角：neck→双髋中点 连线相对竖直方向的偏角（站立时接近 0°）。
  const midHip = {
    x: (p('l_hip').x + p('r_hip').x) / 2,
    y: (p('l_hip').y + p('r_hip').y) / 2,
  };
  const torsoLean = vecAngle(sub(midHip, p('neck')), { x: 0, y: 1 });

  const usedNames = [
    'l_shoulder', 'r_shoulder', 'l_elbow', 'r_elbow',
    'l_hip', 'r_hip', 'l_knee', 'r_knee',
  ];
  const meanConfidence =
    usedNames.reduce((sum, n) => sum + conf(n), 0) / usedNames.length;

  return { angles, torsoLean, meanConfidence };
}

/** 偏差分档得分（对应 score.py ERROR_SCORE：1.0/0.8/0.6/0），此处用于 severity 映射。 */
function severityFromDeviation(deg, bands) {
  if (deg <= bands[0]) return 'none';
  if (deg <= bands[1]) return 'low';
  if (deg <= bands[2]) return 'medium';
  return 'high';
}

/**
 * 每个动作的确定性判定规则。
 * primary：主角度（驱动计数状态机）；down/up：动作幅度阈值（度）。
 * checks：在判定帧上执行；deviation 越界即产生问题部位。
 */
const EXERCISE_RULES = {
  squat: {
    label: '深蹲',
    primary: ['l_knee', 'r_knee'],
    down: 110,
    up: 160,
    partialGap: 25,
    checks: [
      { area: 'shallow_depth', bands: [10, 20, 35], value: (f, r) => Math.max(0, r.bottomPrimary - 110) },
      { area: 'back_rounding', bands: [10, 20, 30], value: (f, r) => Math.max(0, r.bottomTorsoLean - 45) },
      {
        area: 'hip_shift',
        bands: [8, 15, 25],
        value: (f, r) => Math.abs(r.bottomAngles.l_knee - r.bottomAngles.r_knee),
      },
    ],
  },
  push_up: {
    label: '俯卧撑',
    primary: ['l_elbow', 'r_elbow'],
    down: 100,
    up: 160,
    partialGap: 25,
    checks: [
      { area: 'shallow_depth', bands: [10, 20, 35], value: (f, r) => Math.max(0, r.bottomPrimary - 100) },
      {
        area: 'hip_sag',
        bands: [8, 15, 25],
        value: (f, r) => Math.max(0, 165 - Math.min(r.bottomAngles.l_hip, r.bottomAngles.r_hip)),
      },
      {
        area: 'hip_pike',
        bands: [8, 15, 25],
        value: (f, r) => Math.max(0, Math.max(r.bottomAngles.l_hip, r.bottomAngles.r_hip) - 195),
      },
    ],
  },
  lunge: {
    label: '弓步蹲',
    primary: ['l_knee', 'r_knee'],
    down: 110,
    up: 160,
    partialGap: 25,
    checks: [
      { area: 'shallow_depth', bands: [10, 20, 35], value: (f, r) => Math.max(0, r.bottomPrimary - 110) },
      { area: 'torso_lean', bands: [10, 20, 30], value: (f, r) => Math.max(0, r.bottomTorsoLean - 30) },
      {
        area: 'hip_shift',
        bands: [8, 15, 25],
        value: (f, r) => Math.abs(r.bottomAngles.l_knee - r.bottomAngles.r_knee),
      },
    ],
  },
  overhead_press: {
    label: '站姿推举',
    primary: ['l_elbow', 'r_elbow'],
    down: 95,
    up: 160,
    partialGap: 25,
    checks: [
      { area: 'shallow_depth', bands: [10, 20, 35], value: (f, r) => Math.max(0, r.bottomPrimary - 95) },
      {
        area: 'incomplete_lockout',
        bands: [8, 15, 25],
        value: (f, r) => Math.max(0, 165 - Math.max(f.angles.l_elbow, f.angles.r_elbow)),
      },
      { area: 'torso_lean', bands: [10, 20, 30], value: (f, r) => Math.max(0, r.bottomTorsoLean - 20) },
    ],
  },
};

/**
 * 单次动作评估：在判定帧上执行 checks，产出 FormAnalysis 契约结果。
 * @param {string} exercise
 * @param {{angles:Object, torsoLean:number, meanConfidence:number}} frame 判定帧
 * @param {{bottomPrimary:number, bottomTorsoLean:number, bottomAngles:Object, complete:boolean}} rep
 */
function evaluateRep(exercise, frame, rep) {
  const rule = EXERCISE_RULES[exercise];
  const problemAreas = [];
  if (rep.complete) {
    for (const check of rule.checks) {
      const dev = Math.max(0, check.value(frame, rep));
      const severity = severityFromDeviation(dev, check.bands);
      if (severity !== 'none') {
        problemAreas.push({ area: check.area, severity });
      }
    }
  } else {
    // 幅度不足的不完整 rep：明确给深度/幅度纠正。
    problemAreas.push({ area: 'shallow_depth', severity: 'medium' });
  }

  const isStandard = problemAreas.length === 0;
  const meanConf = frame.meanConfidence;
  if (meanConf < 0.5) {
    return { exercise, isStandard: false, confidence: 'low', problemAreas: [], status: 'inconclusive' };
  }
  const confidence = meanConf >= 0.8 ? 'high' : meanConf >= 0.6 ? 'medium' : 'low';
  return { exercise, isStandard, confidence, problemAreas, status: 'conclusive' };
}

/**
 * 计数状态机：主角度 谷值(down)→峰值(up) 完成一次；谷值帧作为判定帧。
 * 幅度未达 down 但回到 up：不完整 rep（仍产分析，计纠正不计标准）。
 */
class RepCounter {
  /**
   * @param {string} exercise
   */
  constructor(exercise) {
    this.exercise = exercise;
    this.rule = EXERCISE_RULES[exercise];
    this.state = 'idle';
    this.bottomPrimary = Infinity;
    this.bottomFrame = null;
    this.bottomTorsoLean = 0;
    this.bottomAngles = null;
    this.minSeen = Infinity;
  }

  /**
   * @param {{angles:Object, torsoLean:number, meanConfidence:number}} frame
   * @returns {{repCompleted:boolean, partial:boolean, analysis:Object|null, hint:string|null}}
   */
  update(frame) {
    const primary = this.rule.primary.reduce(
      (sum, name) => sum + frame.angles[name], 0
    ) / this.rule.primary.length;
    const out = { repCompleted: false, partial: false, analysis: null, hint: null };

    if (frame.meanConfidence < 0.5) {
      // 关键点质量差：不计入状态机，避免误计数。
      out.hint = '请让全身保持在画面内';
      return out;
    }

    this.minSeen = Math.min(this.minSeen, primary);

    switch (this.state) {
      case 'idle':
        if (primary >= this.rule.up) {
          this.state = 'up';
          this._resetDip();
        }
        break;

      case 'up':
        if (primary < this.minSeen) this.minSeen = primary;
        this.bottomPrimary = Math.min(this.bottomPrimary, primary);
        this.bottomFrame = frame;
        this.bottomTorsoLean = frame.torsoLean;
        this.bottomAngles = { ...frame.angles };
        if (primary <= this.rule.down) {
          this.state = 'down';
        } else if (primary >= this.rule.up && this.minSeen < this.rule.down + this.rule.partialGap && this.minSeen > this.rule.down) {
          // 浅幅 rep：有下探但未到位就回到顶部，按不完整 rep 结算（不计标准、给深度纠正）。
          out.partial = true;
          out.analysis = this._evaluate(frame, false);
          this._resetDip();
        } else if (primary >= this.rule.up && this.minSeen >= this.rule.down + this.rule.partialGap) {
          this._resetDip(); // 轻微抖动，忽略
        }
        break;

      case 'down':
        if (primary >= this.rule.up) {
          out.repCompleted = true;
          out.analysis = this._evaluate(frame, true);
          this.state = 'up';
          this._resetDip();
        }
        break;
    }
    return out;
  }

  /** 从 up 直接回到 idle（如用户离开画面）：若本次下探幅度接近到位则按不完整 rep 收尾。 */
  finishDip() {
    if (this.state === 'up' && this.bottomFrame && this.minSeen < this.rule.down + this.rule.partialGap) {
      const analysis = this._evaluate(this.bottomFrame, false);
      this._resetDip();
      return { repCompleted: false, partial: true, analysis, hint: null };
    }
    this._resetDip();
    return { repCompleted: false, partial: false, analysis: null, hint: null };
  }

  _evaluate(frame, complete) {
    const rep = {
      bottomPrimary: this.bottomPrimary,
      bottomTorsoLean: this.bottomTorsoLean,
      bottomAngles: this.bottomAngles || frame.angles,
      complete,
    };
    return evaluateRep(this.exercise, frame, rep);
  }

  _resetDip() {
    this.bottomPrimary = Infinity;
    this.bottomFrame = null;
    this.bottomTorsoLean = 0;
    this.bottomAngles = null;
    this.minSeen = Infinity;
  }
}

module.exports = { KEYPOINT_INDEX, computeAngles, evaluateRep, RepCounter, EXERCISE_RULES, severityFromDeviation };
