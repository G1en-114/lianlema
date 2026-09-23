const store = require('../../store/appStore');

const GOALS = [
  { value: 'fat_loss', label: '减脂' },
  { value: 'muscle_gain', label: '增肌' },
  { value: 'endurance', label: '耐力' },
  { value: 'general_fitness', label: '综合健康' },
];

const VENUES = [
  { value: 'home', label: '家里' },
  { value: 'gym', label: '健身房' },
  { value: 'outdoor', label: '户外' },
];

const EQUIPMENTS = [
  { value: 'none', label: '无器械' },
  { value: 'dumbbell', label: '哑铃' },
  { value: 'barbell', label: '杠铃' },
  { value: 'resistance_band', label: '弹力带' },
  { value: 'bench', label: '凳子' },
];

const INJURY_AREAS = [
  { value: 'shoulder', label: '肩部' },
  { value: 'lower_back', label: '腰背' },
  { value: 'knee', label: '膝盖' },
  { value: 'wrist', label: '手腕' },
  { value: 'neck', label: '颈部' },
];

const LEVELS = [
  { value: 'none', label: '无' },
  { value: 'mild', label: '轻度' },
  { value: 'severe', label: '重度' },
];

function blankInjuryLevels() {
  const o = {};
  for (const a of INJURY_AREAS) o[a.value] = 'none';
  return o;
}

Page({
  data: {
    goals: GOALS,
    venues: VENUES,
    equipments: EQUIPMENTS,
    injuryAreas: INJURY_AREAS,
    levels: LEVELS,
    frequency: [1, 2, 3, 4, 5, 6, 7],
    form: {
      goal: '',
      venue: '',
      equipment: ['none'],
      weeklyFrequency: 3,
    },
    sensitiveConsent: false,
    injuryLevels: blankInjuryLevels(),
    missing: {}, // 缺失类别标识（原需求 1.8）
  },

  onGoalTap(e) {
    this.setData({ 'form.goal': e.currentTarget.dataset.value, 'missing.goal': false });
  },

  onVenueTap(e) {
    this.setData({ 'form.venue': e.currentTarget.dataset.value, 'missing.venue': false });
  },

  onEquipmentTap(e) {
    const value = e.currentTarget.dataset.value;
    let equipment = [...this.data.form.equipment];
    if (value === 'none') {
      equipment = ['none'];
    } else {
      equipment = equipment.filter((v) => v !== 'none');
      if (equipment.includes(value)) {
        equipment = equipment.filter((v) => v !== value);
      } else {
        equipment.push(value);
      }
      if (equipment.length === 0) equipment = ['none'];
    }
    this.setData({ 'form.equipment': equipment });
  },

  onFrequencyPick(e) {
    const value = this.data.frequency[Number(e.detail.value)] || 3;
    this.setData({ 'form.weeklyFrequency': value, 'missing.weeklyFrequency': false });
  },

  /** 敏感健康信息：单独明示同意（原需求 10.5），撤回勾选立即清空已选分级。 */
  onConsentChange(e) {
    const checked = e.detail.value.length > 0;
    this.setData({
      sensitiveConsent: checked,
      injuryLevels: checked ? this.data.injuryLevels : blankInjuryLevels(),
    });
  },

  onInjuryLevelTap(e) {
    if (!this.data.sensitiveConsent) return;
    const { area, value } = e.currentTarget.dataset;
    this.setData({ [`injuryLevels.${area}`]: value });
  },

  submit() {
    const missing = {};
    if (!this.data.form.goal) missing.goal = true;
    if (!this.data.form.venue) missing.venue = true;
    if (!this.data.form.weeklyFrequency) missing.weeklyFrequency = true;
    if (Object.keys(missing).length > 0) {
      this.setData({ missing });
      wx.showToast({ title: '请补全标红的必填项', icon: 'none' });
      return;
    }

    const injuryLevels = this.data.sensitiveConsent ? this.data.injuryLevels : {};
    store.submitAssessment({
      ...this.data.form,
      injuryLevels,
      sensitiveConsent: this.data.sensitiveConsent,
    });
    wx.showToast({ title: '计划已生成', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/plan/plan' }), 600);
  },
});
