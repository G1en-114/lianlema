/**
 * 演示模式姿态 Provider（契约实现二，镜像原 Stub_Form_Provider）。
 * VKSession 不可用或相机未授权时顶替：计时 + 手动计数，分析结果由确定性序列产出。
 * 界面需向用户明示"演示模式：未启用姿态识别"。
 */

/** 确定性桩序列：每个手动确认的 rep 依次取一条（循环）。 */
const STUB_SEQUENCE = [
  { isStandard: true, problemAreas: [] },
  { isStandard: true, problemAreas: [] },
  { isStandard: false, problemAreas: [{ area: 'shallow_depth', severity: 'medium' }] },
];

const demoPoseProvider = {
  mode: 'demo',

  isSupported() {
    return true; // 永远可用，作为降级兜底
  },

  /**
   * @param {{exercise:string, onFrame:(r:Object)=>void}} opts
   */
  start(opts) {
    let repIndex = 0;
    return {
      /** 手动确认完成一次动作 → 产出下一条契约结果。 */
      confirmRep() {
        const item = STUB_SEQUENCE[repIndex % STUB_SEQUENCE.length];
        repIndex += 1;
        const analysis = {
          exercise: opts.exercise,
          isStandard: item.isStandard,
          confidence: 'medium',
          problemAreas: item.problemAreas,
          status: 'conclusive',
        };
        opts.onFrame({ repEvent: { repCompleted: true, partial: false, analysis, hint: null } });
      },
      stop() {},
    };
  },
};

module.exports = { demoPoseProvider, STUB_SEQUENCE };
