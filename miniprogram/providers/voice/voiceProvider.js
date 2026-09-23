/**
 * 语音 Provider：微信同声传译插件（WechatSI）封装，含能力探测与降级。
 * - 插件未在小程序后台添加 → available=false，训练页隐藏语音入口（触控控制全保留）。
 * - TTS 失败 → 返回 { audioUrl:null, ttsFailed:true }，调用方降级为文本（Property 9）。
 *
 * 启用步骤（企业/个人主体均可）：
 * 1. mp.weixin.qq.com → 设置 → 第三方设置 → 插件管理 → 添加"同声传译"（wx069ba97219f66d99）。
 * 2. 在 app.json 根级加入：
 *    "plugins": { "WechatSI": { "version": "0.3.5", "provider": "wx069ba97219f66d99" } }
 * 3. 重新编译即可。
 */

let plugin = null;
try {
  // 未声明插件时 requirePlugin 抛错 → 自动降级
  plugin = typeof requirePlugin === 'function' ? requirePlugin('WechatSI') : null;
} catch (e) {
  plugin = null;
}

const audioCache = new Map(); // text → 临时音频文件路径（对齐原 Voice_Engine 缓存）

const voiceProvider = {
  /** 插件与底层 API 是否可用。 */
  get available() {
    return !!plugin && !!plugin.textToSpeech;
  },

  /**
   * 文本转语音并播放；返回本次合成的音频地址（供"再说一遍"重放）。
   * @param {string} text
   * @returns {Promise<{audioUrl:string|null, ttsFailed:boolean}>}
   */
  speak(text) {
    if (!this.available) {
      return Promise.resolve({ audioUrl: null, ttsFailed: true });
    }
    if (audioCache.has(text)) {
      this._play(audioCache.get(text));
      return Promise.resolve({ audioUrl: audioCache.get(text), ttsFailed: false });
    }
    return new Promise((resolve) => {
      plugin.textToSpeech({
        lang: 'zh_CN',
        tts: true,
        content: text,
        success: (res) => {
          if (res && res.filename) {
            audioCache.set(text, res.filename);
            this._play(res.filename);
            resolve({ audioUrl: res.filename, ttsFailed: false });
          } else {
            resolve({ audioUrl: null, ttsFailed: true });
          }
        },
        fail: () => resolve({ audioUrl: null, ttsFailed: true }),
      });
    });
  },

  _play(filePath) {
    try {
      const audio = wx.createInnerAudioContext();
      audio.src = filePath;
      audio.play();
      audio.onEnded(() => audio.destroy());
      audio.onError(() => audio.destroy());
    } catch (e) {
      /* 播放失败调用方已有文本兜底 */
    }
  },

  /**
   * 语音命令识别（监听模式）。返回 manager 或 null。
   * @param {{onText:(t:string)=>void, onEnd:()=>void, onError:(e:any)=>void}} handlers
   */
  createRecognizer(handlers) {
    if (!this.available || !plugin.getRecordRecognitionManager) return null;
    const manager = plugin.getRecordRecognitionManager();
    manager.onRecognize((res) => {
      if (res && res.result) handlers.onText(res.result);
    });
    manager.onStop(() => handlers.onEnd && handlers.onEnd());
    manager.onError((err) => handlers.onError && handlers.onError(err));
    return manager;
  },
};

module.exports = { voiceProvider };
