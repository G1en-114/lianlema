# 练了吗 · 微信小程序（大赛参赛版）

> 你今天练了吗？—— AI 健身教练微信小程序

本项目是 [lian_le_ma](https://github.com/Health-525/lian_le_ma)（React Native + Expo / FastAPI / RTMPose+ST-GCN）的**微信小程序原生重写版**，为微信小程序大赛打造：无需任何后端即可完整运行，可选接入微信云开发；动作纠错使用**端侧 VKSession 人体姿态识别 + 角度判定算法**（移植自模型层 `src/score.py` 的"距离角度判定"思想）。

## 一、快速开始

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)（稳定版）。
2. 打开开发者工具 → 导入项目 → 选择本目录（`miniprogram/`）→ AppID 选「测试号」或填你自己的小程序 AppID。
3. 编译即可运行：完成运动评估 → 生成 7 天计划 → 开始训练（未授权摄像头时自动进入演示模式）→ 查看报告与历史。

无需配置服务器、无需域名备案、无需开通云开发——默认纯本地模式开箱即用。

## 二、功能总览

| 功能 | 说明 | 与原项目关系 |
|---|---|---|
| 运动评估 | 目标/场地/器械/频率 + 伤痛自评（敏感信息单独同意门控） | 移植 Requirement 1/10 |
| 7 天计划 | 确定性纯函数生成；severe 伤痛剔除动作、mild 附降阶提示 | 移植 `planGenerator.py` |
| 摄像头动作纠错 | VKSession 23 点人体关键点 → 8 关节角 → 分档判定 + rep 计数；支持深蹲/弓步蹲/俯卧撑/站姿推举 | 移植 `score.py` 角度判定思想 |
| 演示模式 | 设备不支持/相机被拒时：手动计数 + 桩序列纠错，界面明示 | 对应 `Stub_Form_Provider` |
| 语音命令 | 同声传译插件（可选）→ 暂停/继续/换动作/降低难度/再说一遍/结束；未配置则触控 | 移植 Requirement 6 |
| 情绪价值 | 完成一组/最后一次/连续 3 次标准/结束时模板鼓励；可选 TTS 播报 | 移植 Requirement 8 |
| 训练报告 | 动作分（0-100）/纠正次数/风险提示/下次重点，全部确定性计算 | 移植 `form_score/next_focus` |
| 训练记录 | 本地（默认）或云开发集合，时间倒序 | 移植 Requirement 11 |
| 付费墙 | 免费额度 3 次；演示模式明示模拟解锁（个人主体合规处理） | 移植 Requirement 9 |
| 隐私中心 | 授权状态查看/系统授权跳转/撤回敏感同意并清空/清除全部数据 | 移植 Requirement 10 |

**设计红线（与原项目一致）**：计划、动作分、下次重点等数值全部由确定性纯函数产出，绝不由 LLM 生成；动作"是否标准"只由姿态判定 Provider 产出；所有能力可降级，永不变砖。

## 三、目录结构

```
miniprogram/
├── app.js / app.json / app.wxss / config.js / sitemap.json
├── core/            # 确定性领域模块（Node 可单测）
│   ├── catalog.js         动作库与相容性过滤
│   ├── planGenerator.js   7 天计划生成
│   ├── poseRules.js       关节角计算 + 分档判定 + rep 状态机
│   ├── formScore.js       报告计算
│   ├── corrections.js     纠正文案模板
│   ├── encourage.js       鼓励文案
│   ├── voiceCommands.js   语音命令意图映射
│   └── entitlement.js     权益/付费墙
├── providers/
│   ├── pose/         vkPoseProvider（端侧识别）/ demoPoseProvider（降级）
│   ├── voice/        voiceProvider（同声传译插件，可选）
│   └── repo/         index / localRepo（默认）/ cloudRepo（可选）
├── store/appStore.js
├── pages/            plan · assessment · training · report · history · profile · paywall
├── assets/icons/     tabBar 图标
cloudfunctions/login/  可选云函数（openid）
test/                  Node 单元测试（36 条）
```

## 四、运行测试

```bash
node --test "test/*.test.js"
```

覆盖原设计的 Correctness Properties：计划结构/伤痛规避/确定性边界（P1-P4）、纠正一致性（P6/P8）、动作分边界（P7）、语音命令封闭性（P10）、权益付费墙一致性（P11）等。

## 五、可选增强

### 启用语音命令与语音播报（同声传译插件）

1. mp.weixin.qq.com → 设置 → 第三方设置 → 插件管理 → 添加「同声传译」（provider `wx069ba97219f66d99`）。
2. 在 `app.json` 根级加入（未添加插件前**不要**加入，否则编译报错）：

```json
"plugins": {
  "WechatSI": { "version": "0.3.5", "provider": "wx069ba97219f66d99" }
}
```

3. 重新编译；训练页出现「按住说话」按钮。插件缺失时语音自动隐藏，触控控制全保留。

### 启用云开发（多设备同步）

1. mp.weixin.qq.com → 开通「云开发」，创建环境，复制环境 ID。
2. `miniprogram/config.js` 中填入 `CLOUD_ENV_ID`。
3. 开发者工具 → 云开发 → 创建集合：`assessments`、`plans`、`entitlements`、`consents`、`sessions`，权限选「仅创建者可读写」。
4. （可选）右键 `cloudfunctions/login` → 上传并部署。
5. 未配置或调用失败时自动降级本地模式，功能不受影响。

### 切换为企业主体 + 真实微信支付

- `pages/paywall/paywall.js` 的 `purchase()` 替换为 `wx.requestPayment` 流程（需微信支付商户号）；
- `core/entitlement.js` 的 `grantPro` 改为凭证校验后发放；
- 移除界面上的「演示/模拟解锁」字样。

### 接入微信 AI 生态（大赛"AI应用创新"评审项）

分三层，前三步零代码、可随正式版提审：

1. **自动模式（正式版，必做）**：mp 后台 → 基础功能 → AI 能力 → 开启接入（自动模式）。微信 AI 即可推荐与调用本小程序，无代码改动。
2. **AI 文案润色（正式版可选）**：
   - 开通云开发并在 `config.js` 填 `CLOUD_ENV_ID`（见上节）；
   - `cloudfunctions/llmcoach` 右键"上传并部署（云端安装依赖）"，并在云函数控制台配置环境变量 `HUNYUAN_SECRET_ID` / `HUNYUAN_SECRET_KEY`（腾讯云混元密钥，切勿写入代码）；
   - `config.js` 将 `ENABLE_AI_TEXT` 改为 `true`。
   - 行为：鼓励/纠正/小结文案先按模板即时展示，AI 润色（含 msgSecCheck 内容安全检查）返回后无感替换；任何失败自动回退模板，数值永不由 AI 生成。
3. **开发模式 SKILL（内测就绪，暂不合入正式版）**：完整参考实现见仓库 `wechat-ai-skill/`（fitness-coach 技能：今日计划/最近报告/动作目录 3 个原子接口 + AGENTS.md 教练人设 + 服务直达元数据）。官方内测明确"勿将此模式代码合入正式版本提审"，提审通道开放后按 `wechat-ai-skill/README-接入与合并指南.md` 约 10 分钟合并。

## 六、注册与上线清单（大赛要求：2026-07-17 ~ 10-17 内首次上线）

1. **注册账号**：mp.weixin.qq.com → 立即注册 → 小程序。个人主体需身份证 + 手机号；一个身份证最多注册 5 个（一年 2 个）。
2. **类目选择**：建议首选「工具-效率」（个人主体可选、无需资质）；若主体含体育相关资质可选「体育」类目。避免选择「医疗-健康管理」等需资质类目。
3. **完善信息**：填写小程序名称（如"练了吗AI健身"）、头像、简介；服务类目与实际功能一致。
4. **隐私保护指引**：mp 后台 → 设置 → 基本设置 → 用户隐私保护指引 → 声明收集信息：「摄像头（拍摄）、麦克风（语音命令）」，用途如实填写；与 `app.json` 中 `__usePrivacyCheck__: true` 配套。
5. **接入微信 AI 生态（自动模式）**：mp 后台 → 基础功能 → AI 能力 → 开启接入。零代码，随版本提审生效（详见第五节）。
6. **修改 AppID**：`miniprogram/project.config.json` 的 `appid` 改为你自己的。
7. **真机冒烟**（见下节）。
8. **上传与提审**：开发者工具 → 上传 → 版本号 1.0.0 → mp 后台 → 版本管理 → 提交审核。审核时备注：工具类健身辅助小程序，无社交/UGC/支付功能（演示解锁不涉真实资金）。
9. **发布**：审核通过后发布，即满足大赛"提报阶段内正式上线"要求。注意：大赛规则要求**首次上线时间在窗口内**，此前请勿提前发布。

> 六项参赛材料（证件/名称/AppID/二维码/介绍文档 PDF/授权书）的准备状态与提交指引，见仓库 `competition/参赛材料清单与提交指引.md`；介绍文档 PDF 已生成于 `competition/小程序介绍文档.pdf`。

### 真机冒烟清单（上线前必做）

- [ ] 全新用户：评估（勾选/不勾选敏感同意两条路径）→ 计划生成正确
- [ ] 训练页：**VK 姿态识别**——正面站入画面，深蹲计数正确、纠错文案出现；确认骨架叠加层与身体对齐（如偏移，调整 `providers/pose/vkPoseProvider.js` 中 `FRAME_SCALE_X/Y` 与 `KEYPOINT_INDEX`，关键点索引以[官方 Body 检测文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html)配图为准）
- [ ] 相机拒绝路径：拒绝授权 → 演示模式提示与手动计数可用；「我的-授权中心」可跳系统设置
- [ ] 组间休息倒计时 → 下一组自动恢复；结束训练 → 报告 → 历史可回看
- [ ] 付费墙：第 4 次训练被拦截 → 演示解锁 → 不再受限
- [ ] 隐私中心：撤回敏感同意 → 数据清空且计划重新生成；清除全部数据
- [ ] （若启用插件）语音命令六意图 + TTS 播报；（未启用）语音入口隐藏
- [ ] 休息日当天不可开训，展示休息提示

## 七、大赛合规对照

| 要求 | 落实 |
|---|---|
| 《微信小程序设计指南》 | 750rpx 网格、tab 三页签、每页标题、≥88rpx 可点区域、加载/空态/降级提示、统一色板与字号 |
| 《微信小程序平台运营规范》 | 无诱导分享、无 UGC、无外部链接；付费墙明示"演示环境：模拟解锁，不产生真实扣费"；隐私接口 + 《用户隐私保护指引》配置；敏感健康信息单独明示同意、可撤回；AI 生成文案经 msgSecCheck 内容安全检查 |
| 原创性与 AI 使用合规可追溯（规程二(5)/七(4)） | 参赛者自有项目移植 + AI 辅助开发在介绍文档第十节披露；设计文档/36 条单元测试/过程记录留存于仓库，可作溯源材料 |
| 接入微信 AI 生态（规程二(4)，评审"AI应用创新"） | 自动模式后台授权（正式版）+ AI 文案润色云函数（可选启用）+ 开发模式 SKILL 参考实现（内测就绪，独立目录不合入提审版） |
| 提报阶段内上线 | 上线时间窗口 2026-07-17 ~ 10-17，见第六节清单第 9 条 |
| 正常运行 | 纯本地模式零依赖可运行；所有能力（VK/插件/云/AI）缺失均自动降级 |

## 八、已知限制与后续路线

- 关键点索引映射 `KEYPOINT_INDEX` 采用社区通行 body-18 布局，真机校准一次即可（见冒烟清单）；叠加层对齐同理。
- 演示模式的纠错文案为桩序列（与原 `Stub_Form_Provider` 同思路），仅用于链路演示。
- 后续可接入：云端 GPU 推理（RTMPose+ST-GCN 完整模型，走同一 `FormAnalysisProvider` 契约）、LLM 文案润色（模板兜底不变）、微信支付（企业主体）。

内容不构成医疗建议。训练量力而行，如有伤痛请先咨询专业医师。
