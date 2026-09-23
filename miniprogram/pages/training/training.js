const store = require('../../store/appStore');
const { withCorrectionText } = require('../../core/formScore');
const { composeCorrection } = require('../../core/corrections');
const { pickEncouragement } = require('../../core/encourage');
const { matchCommand, COMMAND_LABELS } = require('../../core/voiceCommands');
const { vkPoseProvider } = require('../../providers/pose/vkPoseProvider');
const { demoPoseProvider } = require('../../providers/pose/demoPoseProvider');
const { voiceProvider } = require('../../providers/voice/voiceProvider');
const coachProvider = require('../../providers/coach/coachProvider');

const encourageCounters = { set_done: 0, last_rep: 0, streak_standard: 0, session_end: 0 };

Page({
  data: {
    exerciseName: '',
    exerciseNote: null,
    setNo: 1,
    totalSets: 1,
    repCount: 0,
    targetReps: 0,
    poseMode: 'demo', // 'vk' | 'demo'
    paused: false,
    resting: false,
    restLeft: 0,
    message: '准备开始，先活动一下肩和髋。',
    messageIsCorrection: false,
    primaryAngle: 0,
    confidence: 0,
    finished: false,
    voiceAvailable: false,
    recording: false,
  },

  onLoad(options) {
    this.startedAt = new Date().toISOString();
    this.exercises = [];
    this.exIdx = 0;
    this.setNo = 1;
    this.repCount = 0;
    this.streak = 0;
    this.provider = null;
    this.restTimer = null;
    this.canvasNode = null;

    const s = store.getState();
    const dayIndex = Number(options.dayIndex) || 1;
    const day = s.plan && s.plan.days.find((d) => d.dayIndex === dayIndex);
    this.exercises = day && !day.isRestDay ? day.exercises : [];

    this.setData({ voiceAvailable: voiceProvider.available });
    if (this.exercises.length === 0) {
      wx.showToast({ title: '今天没有安排训练', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    store.startSession(); // 消耗一次免费额度（进入即开卡）
    this.prepareCanvas();
    this.startExercise(0);
  },

  onUnload() {
    this.stopProvider();
    if (this.restTimer) clearInterval(this.restTimer);
  },

  prepareCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#poseCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const node = res[0].node;
        node._width = res[0].width;
        node._height = res[0].height;
        this.canvasNode = node;
      }
    });
  },

  /** 启动当前动作：优先 VK 姿态识别，不可用/相机被拒降级演示模式。 */
  startExercise(idx) {
    this.stopProvider();
    this.exIdx = idx;
    const ex = this.exercises[idx];
    this.setNo = 1;
    this.repCount = 0;
    this.streak = 0;
    this.targetReps = ex.reps;

    this.setData({
      exerciseName: ex.name,
      exerciseNote: ex.regressionNote,
      totalSets: ex.sets,
      setNo: 1,
      repCount: 0,
      targetReps: ex.reps,
      message: `开始 ${ex.name}，注意动作质量。`,
      messageIsCorrection: false,
      primaryAngle: 0,
    });

    const needsPose = !!ex.exercise;
    if (needsPose && vkPoseProvider.isSupported()) {
      this.authorizeCamera().then((granted) => {
        if (granted) this.startVk(ex);
        else this.startDemo('未授权摄像头，已切换演示模式');
      });
    } else {
      const reason = !needsPose ? '该动作按节奏自主完成' : '当前设备不支持姿态识别，已切换演示模式';
      this.startDemo(reason);
    }
  },

  authorizeCamera() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.camera'] === true) return resolve(true);
          if (res.authSetting['scope.camera'] === false) {
            wx.showModal({
              title: '需要摄像头权限',
              content: '动作纠错依赖摄像头识别你的动作。拒绝也可用演示模式训练。',
              confirmText: '去设置',
              success: (r) => {
                if (r.confirm) {
                  wx.openSetting({ success: (s) => resolve(!!s.authSetting['scope.camera']) });
                } else resolve(false);
              },
            });
          } else {
            wx.authorize({
              scope: 'scope.camera',
              success: () => resolve(true),
              fail: () => resolve(false),
            });
          }
        },
        fail: () => resolve(false),
      });
    });
  },

  startVk(ex) {
    if (!this.canvasNode) this.prepareCanvas();
    try {
      this.provider = vkPoseProvider.start({
        exercise: ex.exercise,
        canvas: this.canvasNode,
        onFrame: (r) => this.handleRepEvent(r.repEvent, r.primaryAngle, r.confidence),
        onError: () => this.startDemo('姿态识别启动失败，已切换演示模式'),
      });
      this.setData({ poseMode: 'vk' });
    } catch (e) {
      this.startDemo('姿态识别启动失败，已切换演示模式');
    }
  },

  startDemo(reason) {
    this.stopProvider();
    this.lastDemoReason = reason;
    this.provider = demoPoseProvider.start({
      exercise: (this.exercises[this.exIdx] || {}).exercise,
      onFrame: (r) => this.handleRepEvent(r.repEvent, 0, 1),
    });
    this.setData({ poseMode: 'demo', message: `${reason}。跟练节奏自主完成，点「确认完成一次」计数。`, messageIsCorrection: false });
  },

  /** 休息结束后恢复当前动作的计数（VK 或演示模式）。 */
  resumeProviderAfterRest() {
    const ex = this.exercises[this.exIdx];
    if (this.data.poseMode === 'vk' && ex.exercise && vkPoseProvider.isSupported()) {
      this.stopProvider();
      this.provider = vkPoseProvider.start({
        exercise: ex.exercise,
        canvas: this.canvasNode,
        onFrame: (r) => this.handleRepEvent(r.repEvent, r.primaryAngle, r.confidence),
        onError: () => this.startDemo('姿态识别启动失败，已切换演示模式'),
      });
    } else {
      this.startDemo(this.lastDemoReason || '演示模式');
    }
  },

  stopProvider() {
    if (this.provider) {
      try { this.provider.stop(); } catch (e) { /* ignore */ }
      this.provider = null;
    }
  },

  /** rep 事件统一入口：记录分析、更新横幅、判断组完成。 */
  handleRepEvent(repEvent, primaryAngle, confidence) {
    if (this.data.paused || this.data.resting || this.data.finished) return;

    if (!repEvent || (!repEvent.repCompleted && !repEvent.partial)) {
      if (this.data.poseMode === 'vk') {
        if (repEvent && repEvent.hint) {
          this.setData({ message: repEvent.hint, messageIsCorrection: true });
        }
        const deg = Math.round(primaryAngle || 0);
        if (deg !== this._lastDeg) {
          this._lastDeg = deg;
          this.setData({ primaryAngle: deg, confidence: Math.round((confidence || 0) * 100) });
        }
      }
      return;
    }

    const analysis = withCorrectionText(repEvent.analysis);
    store.recordAnalysis(analysis);

    let message;
    let isCorrection = false;
    if (!analysis.isStandard && analysis.correctionText) {
      message = analysis.correctionText;
      isCorrection = true;
      this.streak = 0;
    } else if (analysis.isStandard) {
      this.streak += 1;
      message = analysis.status === 'conclusive' ? '到位！保持这个感觉。' : '没看清动作，调整站位让全身入镜。';
      if (analysis.status === 'inconclusive') isCorrection = true;
      if (this.streak === 3) {
        message = pickEncouragement('streak_standard', encourageCounters.streak_standard++);
      }
    } else {
      message = '这次幅度不够，下一次做满。';
      isCorrection = true;
    }

    if (repEvent.partial) {
      // 未计入的半个 rep，不推进计数
      this.say(message);
      this.setData({ message, messageIsCorrection: isCorrection });
      return;
    }

    const repCount = this.repCount + 1;
    this.repCount = repCount;
    const done = repCount >= this.data.targetReps;

    if (done) {
      const isLastRep = repCount === this.data.targetReps;
      if (isLastRep) {
        message = `${pickEncouragement('last_rep', encourageCounters.last_rep++)} 本组完成！`;
      }
    }

    this.setData({ repCount, message, messageIsCorrection: isCorrection });
    this.say(message, isCorrection ? 'correction' : 'encourage');

    if (done) this.completeSet();
  },

  /** 组间休息 → 下一组/下一动作/结束。 */
  completeSet() {
    const ex = this.exercises[this.exIdx];
    if (this.setNo < ex.sets) {
      this.beginRest(ex.restSec, () => {
        this.setNo += 1;
        this.repCount = 0;
        this.setData({ setNo: this.setNo, repCount: 0, resting: false, message: `第 ${this.setNo} 组，开始！`, messageIsCorrection: false });
        this.resumeProviderAfterRest();
      });
    } else if (this.exIdx < this.exercises.length - 1) {
      this.beginRest(ex.restSec, () => {
        this.setData({ resting: false });
        this.startExercise(this.exIdx + 1);
      });
    } else {
      this.finishSession();
    }
  },

  beginRest(seconds, onDone) {
    this.stopProvider();
    if (this.restTimer) clearInterval(this.restTimer);
    let left = seconds;
    this.setData({ resting: true, restLeft: left, message: `本组完成！休息 ${left} 秒。`, messageIsCorrection: false });
    this.say(`本组完成，休息一下`);
    this.restTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(this.restTimer);
        this.restTimer = null;
        onDone();
      } else {
        this.setData({ restLeft: left });
      }
    }, 1000);
  },

  /** 播报：模板即时展示 + 语音；开启 AI 文案后异步升级措辞（过期消息不回写）。 */
  say(text, scene) {
    this.lastMessage = text;
    voiceProvider.speak(text);
    if (coachProvider.available()) {
      const token = (this._msgToken = (this._msgToken || 0) + 1);
      coachProvider.polish(text, { scene: scene || 'encourage' }).then((better) => {
        if (better && better !== text && token === this._msgToken && this.lastMessage === text) {
          this.setData({ message: better });
        }
      });
    }
  },

  // ===== 训练控制（触控 + 语音共用）=====

  togglePause() {
    const paused = !this.data.paused;
    this.setData({ paused, message: paused ? '已暂停' : '继续训练', messageIsCorrection: false });
    if (!paused && this.lastMessage) this.say(this.lastMessage);
  },

  switchExercise() {
    if (this.exIdx < this.exercises.length - 1) {
      this.startExercise(this.exIdx + 1);
      wx.showToast({ title: '已切换动作', icon: 'none' });
    } else {
      wx.showToast({ title: '已是最后一个动作', icon: 'none' });
    }
  },

  reduceDifficulty() {
    const next = Math.max(5, Math.round(this.data.targetReps * 0.7));
    this.setData({ targetReps: next, message: `难度已降低：本组目标 ${next} 次。`, messageIsCorrection: false });
    this.say(`难度已降低`);
  },

  repeatMessage() {
    if (this.lastMessage) {
      this.setData({ message: this.lastMessage });
      this.say(this.lastMessage);
    }
  },

  confirmEnd() {
    wx.showModal({
      title: '结束训练',
      content: '将立即生成本次训练报告。',
      confirmText: '结束',
      cancelText: '继续练',
      success: (r) => {
        if (r.confirm) this.finishSession();
      },
    });
  },

  // ===== 演示模式手动计数 =====

  manualRep() {
    if (this.provider && this.provider.confirmRep) this.provider.confirmRep();
  },

  // ===== 语音命令 =====

  onVoiceStart() {
    if (!voiceProvider.available || this.data.resting) return;
    wx.getSetting({
      success: (res) => {
        const granted = res.authSetting['scope.record'] === true;
        if (granted === false) {
          wx.showToast({ title: '未授权麦克风，可使用按钮控制', icon: 'none' });
          return;
        }
        const grantedNow = granted ? Promise.resolve(true) : new Promise((resolve) =>
          wx.authorize({ scope: 'scope.record', success: () => resolve(true), fail: () => resolve(false) })
        );
        grantedNow.then((ok) => {
          if (!ok) return;
          this.recognizer = voiceProvider.createRecognizer({
            onText: (t) => this.handleVoiceText(t),
            onEnd: () => this.setData({ recording: false }),
            onError: () => this.setData({ recording: false }),
          });
          if (this.recognizer) {
            this.recognizer.start({ duration: 6000, lang: 'zh_CN' });
            this.setData({ recording: true });
          }
        });
      },
    });
  },

  onVoiceEnd() {
    if (this.recognizer) {
      try { this.recognizer.stop(); } catch (e) { /* ignore */ }
    }
    this.setData({ recording: false });
  },

  /** 语音文本 → 封闭意图映射；未匹配不产生任何副作用（Property 10）。 */
  handleVoiceText(text) {
    const command = matchCommand(text);
    if (!command || this.data.resting) return;
    const label = COMMAND_LABELS[command] || '';
    switch (command) {
      case 'pause': if (!this.data.paused) this.togglePause(); break;
      case 'resume': if (this.data.paused) this.togglePause(); break;
      case 'switch_exercise': this.switchExercise(); break;
      case 'reduce_difficulty': this.reduceDifficulty(); break;
      case 'repeat': this.repeatMessage(); break;
      case 'end_session': this.confirmEnd(); break;
    }
    if (label && command !== 'repeat') wx.showToast({ title: label, icon: 'none' });
  },

  finishSession() {
    encourageCounters.session_end += 1;
    const endMsg = pickEncouragement('session_end', encourageCounters.session_end);
    this.say(endMsg);
    this.stopProvider();
    if (this.restTimer) clearInterval(this.restTimer);
    if (this.data.finished) return;
    this.setData({ finished: true });
    store.finishSession({ startedAt: this.startedAt }).then(() => {
      wx.redirectTo({ url: '/pages/report/report' });
    });
  },
});
