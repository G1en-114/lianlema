/**
 * 每日微训练推荐（确定性纯函数，Node 可测）。
 *
 * 「智能日常」赛道钩子：按一天中的时间段推荐 1-3 分钟碎片微训练，
 * 让 AI 教练出现在每一天的每个时段——而不只是正式训练日。
 * 推荐完全由当前时间决定（确定性），无随机、无 LLM。
 */

const MICRO_SESSIONS = [
  {
    id: 'morning',
    title: '晨间唤醒',
    startHour: 6,
    endHour: 11,
    minutes: 2,
    focus: '用 2 分钟把身体叫醒',
    items: ['开合跳 30 秒', '颈肩环绕 左右各 20 秒', '站姿体前屈 40 秒'],
  },
  {
    id: 'noon',
    title: '午间激活',
    startHour: 11,
    endHour: 14,
    minutes: 3,
    focus: '午饭后不动，下午就困',
    items: ['靠墙静蹲 30 秒 × 2', '原地高抬腿 20 秒 × 2', '胸椎旋转 左右各 8 次'],
  },
  {
    id: 'deskbreak',
    title: '久坐办公桌拉伸',
    startHour: 14,
    endHour: 18,
    minutes: 2,
    focus: '久坐一小时，起来动两分钟',
    items: ['坐姿转体 左右各 30 秒', '肩胛后缩 12 次', '手腕脚踝环绕 各 30 秒'],
  },
  {
    id: 'evening',
    title: '睡前放松',
    startHour: 18,
    endHour: 24,
    minutes: 3,
    focus: '放松下来，睡得更好',
    items: ['猫牛式 8 次', '婴儿式 45 秒', '腹式呼吸 1 分钟'],
  },
];

/** 按小时取场景；0-6 点归入睡前放松（夜猫子场景）。 */
function pickForHour(hour) {
  const found = MICRO_SESSIONS.find((s) => hour >= s.startHour && hour < s.endHour);
  return found || MICRO_SESSIONS[MICRO_SESSIONS.length - 1];
}

/**
 * @param {Date} now 注入当前时间（可测）
 * @returns {{primary:object, note:string, hour:number}}
 */
function dailyPicks(now = new Date()) {
  const hour = now.getHours();
  const weekday = now.getDay(); // 0 = 周日
  const isWeekend = weekday === 0 || weekday === 6;
  return {
    primary: pickForHour(hour),
    note: isWeekend ? '周末节奏轻一点，微训练随时补' : '工作日碎片时间，2 分钟就够',
    hour,
  };
}

module.exports = { MICRO_SESSIONS, pickForHour, dailyPicks };
