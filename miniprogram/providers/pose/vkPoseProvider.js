/**
 * VKSession 姿态 Provider：端侧人体关键点 → 角度判定 → rep 计数（契约实现一）。
 * 设备/基础库不支持时由 demoPoseProvider 顶替（Provider 降级链，对齐原需求 4.2）。
 */
const { computeAngles } = require('../../core/poseRules');
const { RepCounter } = require('../../core/poseRules');

/** 骨架连线（KEYPOINT_INDEX 索引），用于 canvas 叠加绘制。 */
const SKELETON = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], // 肩线、左臂、右臂
  [5, 11], [6, 12], [11, 12], // 躯干
  [11, 13], [13, 15], [12, 14], [14, 16], // 腿
];

/** 事件节流：每 N 帧重绘一次骨架。 */
const DRAW_EVERY = 2;

const vkPoseProvider = {
  mode: 'vk',

  /** 基础库 ≥2.28.0 且 v1 支持时可用。 */
  isSupported() {
    try {
      return typeof wx !== 'undefined' && typeof wx.isVKSupport === 'function' && wx.isVKSupport('v1');
    } catch (e) {
      return false;
    }
  },

  /**
   * 启动会话。page 需已渲染 camera + canvas(type=2d)。
   * @param {{exercise:string, canvas:any, onFrame:(r:Object)=>void, onError:(e:Error)=>void}} opts
   * @returns provider 实例（start/stop）
   */
  start(opts) {
    const session = wx.createVKSession({ track: { body: { mode: 1 } } });
    const repCounter = new RepCounter(opts.exercise);
    let frameCount = 0;
    let smooth = null; // EMA 平滑后的关节角

    session.on('updateAnchors', (anchors) => {
      frameCount += 1;
      if (!anchors || anchors.length === 0) return;
      const anchor = anchors[0];
      const points = anchor.points || [];
      if (points.length < 14) return;
      const confidence = Array.isArray(anchor.confidence)
        ? anchor.confidence
        : points.map(() => anchor.score == null ? 1 : anchor.score);

      const raw = computeAngles(points, confidence);
      // EMA 平滑（α=0.6 抑制抖动）
      if (!smooth) {
        smooth = { angles: { ...raw.angles }, torsoLean: raw.torsoLean, meanConfidence: raw.meanConfidence };
      } else {
        for (const k of Object.keys(raw.angles)) {
          smooth.angles[k] = smooth.angles[k] * 0.4 + raw.angles[k] * 0.6;
        }
        smooth.torsoLean = smooth.torsoLean * 0.4 + raw.torsoLean * 0.6;
        smooth.meanConfidence = raw.meanConfidence;
      }

      const repEvent = repCounter.update(smooth);

      if (frameCount % DRAW_EVERY === 0 && opts.canvas) {
        this._draw(opts.canvas, points, anchor);
      }

      opts.onFrame({
        angles: smooth.angles,
        confidence: smooth.meanConfidence,
        repEvent,
        primaryAngle:
          repCounter.rule.primary.reduce((s, n) => s + smooth.angles[n], 0) /
          repCounter.rule.primary.length,
      });
    });

    session.on('removeAnchors', () => {
      // 人离开画面：收尾未完成的下探
      const ev = repCounter.finishDip();
      if (ev.analysis) opts.onFrame({ angles: null, confidence: 0, repEvent: ev, primaryAngle: 0 });
    });

    session.start((errno) => {
      if (errno) {
        opts.onError(new Error(`VKSession 启动失败 errno=${errno}`));
      }
    });

    return {
      stop() {
        try {
          session.stop();
          session.destroy();
        } catch (e) {
          /* ignore */
        }
      },
    };
  },

  /**
   * 将关键点/骨架画到 canvas 2d 叠加层。
   * 注意：mode 1 下 anchor.points 的坐标空间与相机帧一致；不同机型取景比例存在差异，
   * 叠加层对齐以真机冒烟为准，必要时调整 FRAME_SCALE_X/Y（不影响角度判定与计数）。
   */
  _draw(canvas, points, anchor) {
    if (!canvas || !canvas._width || !canvas._height) return; // canvas 未就绪时跳过本帧
    const FRAME_SCALE_X = 1;
    const FRAME_SCALE_Y = 1;
    const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
    if (!canvas._inited) {
      canvas.width = canvas._width * dpr;
      canvas.height = canvas._height * dpr;
      canvas.getContext('2d').scale(dpr, dpr);
      canvas._inited = true;
    }
    const ctx = canvas.getContext('2d');
    const w = canvas._width;
    const h = canvas._height;
    ctx.clearRect(0, 0, w, h);

    const pts = points.map((p) => ({ x: p.x * FRAME_SCALE_X, y: p.y * FRAME_SCALE_Y }));
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(22,163,74,0.9)';
    for (const [a, b] of SKELETON) {
      if (!pts[a] || !pts[b]) continue;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (const p of pts) {
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

module.exports = { vkPoseProvider, SKELETON };
