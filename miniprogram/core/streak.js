/**
 * 连续打卡（纯函数，Node 可测）。
 *
 * 规则：某日（本地时区）有任意训练会话结束（endedAt）记为该日打卡；
 * 从今天往回数连续打卡天数；今天尚未训练不打断连胜（从昨天起算）。
 * 「智能日常」钩子：习惯环是 AI 教练进入每一天的核心回路。
 */

/** 本地时区的日期键 yyyy-mm-dd。 */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * @param {Array<{endedAt?:string}>} sessions 训练历史（任意顺序）
 * @param {Date} now 注入当前时间（可测）
 * @returns {number} 连续打卡天数（0 = 尚未形成连胜）
 */
function computeStreak(sessions, now = new Date()) {
  if (!Array.isArray(sessions) || sessions.length === 0) return 0;
  const days = new Set(
    sessions
      .map((s) => (s && s.endedAt ? dayKey(new Date(s.endedAt)) : null))
      .filter(Boolean)
  );
  if (days.size === 0) return 0;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1); // 今天未练不打断

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

module.exports = { computeStreak, dayKey };
