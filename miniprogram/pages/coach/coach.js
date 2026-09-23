/**
 * AI 教练对话页（天猫黑客松 AI 服务版核心页面）。
 * - 连接云端模型服务时走 /api/coach/chat（LLM 教练大脑）；
 * - 未连接/请求失败时回退本地确定性模板（与后端 TemplateCoach 同规则），
 *   页面永远可用，sourceLabel 标明回复来源，不冒充 AI。
 * - 随对话附带的 context 只引用 store 中的结构化事实（红线：LLM 不编数据）。
 */
const store = require('../../store/appStore');
const { modelService } = require('../../providers/model/modelServiceProvider');
const { computeStreak } = require('../../core/streak');
const { dailyPicks } = require('../../core/dailyPicks');

let seq = 0;

function summarizePlan(state) {
  if (!state.plan || !state.assessment) return null;
  const daysSince = Math.floor(
    (Date.now() - new Date(state.assessment.createdAt).getTime()) / 86400000
  );
  const todayIndex = (((daysSince % 7) + 7) % 7) + 1;
  const today = state.plan.days.find((d) => d.dayIndex === todayIndex);
  if (!today) return null;
  if (today.isRestDay) return '今日休息日';
  return today.exercises.map((e) => e.name).join('、');
}

function summarizeReport(state) {
  const last = state.sessions && state.sessions[0];
  if (!last || !last.report) return null;
  const r = last.report;
  return `动作分 ${r.formScore}，纠正 ${r.correctionCount} 次，下次重点 ${r.nextFocus || '无'}`;
}

/** 本地模板回复（确定性，镜像后端 TemplateCoach 规则）。 */
function localReply(content, context) {
  const text = content || '';
  if (/练什么|微训练|安排/.test(text)) {
    const pick = dailyPicks();
    const p = pick.primary;
    return `现在这个时段推荐「${p.title}」（${p.minutes} 分钟）：${p.items.join('；')}。${p.focus}。`;
  }
  if (/上次|报告|怎么样/.test(text) && context.latest_report) {
    return `上次训练：${context.latest_report}。${context.nextSuggestion || ''}`;
  }
  const parts = [];
  if (context.streak_days > 0) parts.push(`你已经连续打卡 ${context.streak_days} 天，保持这个节奏！`);
  if (context.today_plan) parts.push(`今天的计划是：${context.today_plan}。`);
  if (!parts.length) parts.push('今天还没安排训练，从 1 分钟微训练开始也不错。');
  return parts.join('');
}

Page({
  data: {
    messages: [],
    draft: '',
    thinking: false,
    offline: !modelService.available(),
    anchor: '',
    quickPrompts: ['今天练什么？', '我上次练得怎么样？', '给我一个 2 分钟微训练'],
  },

  onLoad(options) {
    const s = store.getState();
    this.context = {
      today_plan: summarizePlan(s),
      latest_report: summarizeReport(s),
      exercise: null,
      streak_days: computeStreak(s.sessions),
    };
    this.push('assistant', '我是你的随身 AI 教练。今天练什么、动作怎么改、碎片时间怎么动，都可以问我。');
    if (options && options.prompt) {
      this.setData({ draft: decodeURIComponent(options.prompt) }, () => this.send());
    }
  },

  onInput(e) {
    this.setData({ draft: e.detail.value });
  },

  onQuick(e) {
    this.setData({ draft: e.currentTarget.dataset.q }, () => this.send());
  },

  push(role, content, suggestions, source) {
    const id = (seq += 1);
    const sourceLabel = source === 'llm' ? '云端 AI 教练大脑' : source === 'template' ? '本地模板回复' : '';
    const messages = this.data.messages.concat({
      id,
      role,
      content,
      suggestions: suggestions || [],
      sourceLabel: role === 'assistant' ? sourceLabel : '',
    });
    this.setData({ messages, anchor: `m${id}` });
  },

  chatHistory() {
    return this.data.messages
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));
  },

  send() {
    const content = (this.data.draft || '').trim();
    if (!content || this.data.thinking) return;
    this.push('user', content);
    this.setData({ draft: '', thinking: true });

    modelService
      .chat(this.chatHistory(), this.context)
      .then((reply) => {
        this.setData({ thinking: false });
        this.push('assistant', reply.reply, reply.suggestions, reply.source);
      })
      .catch(() => {
        // 未连接/失败 → 本地模板兜底（与后端 TemplateCoach 同规则，确定性）。
        this.setData({ thinking: false });
        this.push('assistant', localReply(content, this.context), null, 'template');
      });
  },
});
