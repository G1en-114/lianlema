# 小练 Daily · 微信小程序（天猫黑客松定制版）

> 每天动一动，AI 教练在身边。

基于 [lian_le_ma](https://github.com/Health-525/lian_le_ma) 模型层的**AI 服务版小程序**（智能日常赛道定制款）：端侧姿态 AI 打底，云端「视觉模型 + LLM 教练大脑」作为大模型增强层。未连接云端时零配置可完整运行，所有 AI 入口自动降级并明确标注。

## 一、快速开始

1. 微信开发者工具导入本目录（`miniprogram/`）→ AppID 选「测试号」。
2. 编译即运行：评估 → 7 天计划 → 训练（端侧 VKSession 姿态纠错）→ 报告 → 打卡连胜。
3. 新增页面：**AI 教练**（对话式教练大脑）。

## 二、AI 能力分层

| 入口 | 能力 | 端侧 | 云端 |
|---|---|---|---|
| 首页·打卡连胜卡 | 连续打卡天数（`core/streak.js` 纯函数） | ✓ | — |
| 首页·微训练推荐 | 分时段推荐（`core/dailyPicks.js`：晨间/午间/久坐/睡前） | ✓ | — |
| AI 教练页 | 对话式教练 | 本地模板回复 | LLM 教练大脑（`/api/coach/chat`） |
| 训练页·姿态纠错 | VKSession 关键点 → 角度规则 → rep/纠错 | ✓ | — |
| 训练页·☁️ 云端增强 | 组末云端复盘：ST-GCN 动作识别 + LLM 复盘文案 | — | ✓ |

**安全红线不变**：动作分/计数/标准度等数值永远出自模型或确定性规则；LLM/VLM 只消费结构化事实产文案；云端不可用时静默降级，训练主链路绝不中断。

## 三、连接云端模型服务（演示完整链路）

1. 启动 backend（见仓库根 README《快速开始》）：`uvicorn app.main:app --port 8000`。
2. 本目录 `config.js`：
   - `MODEL_SERVICE_BASE_URL: 'http://<电脑局域网IP>:8000'`（真机需同 WiFi；开发者工具可用 `http://127.0.0.1:8000`）；
   - backend 配置了 `MODEL_SERVICE_API_KEYS` 时，在 `MODEL_SERVICE_API_KEY` 填对应 key。
3. 训练页打开「☁️ 云端 AI 增强」→ 完成一组 → 自动云端复盘。
4. 自研 ST-GCN 识别需在 backend 置 `ENABLE_STGCN=1`（依赖健康 torch 环境，默认关闭走桩兜底）。

## 四、目录结构（定制版增量）

```
miniprogram/
├── config.js               # + MODEL_SERVICE_BASE_URL / MODEL_SERVICE_API_KEY
├── core/
│   ├── streak.js           # 连续打卡（纯函数）
│   ├── dailyPicks.js       # 分时段微训练推荐（纯函数）
│   └── entitlement.js      # 权益数据面（UI 无门控；API-key/用量计量为厂商商业化预留）
├── providers/
│   ├── model/modelServiceProvider.js  # 云端模型服务（body-18→COCO-17 重排）
│   └── pose/vkPoseProvider.js         # + 可选 onKeypoints 旁路（云端分析取数）
├── pages/
│   ├── coach/              # 新增：AI 教练对话页
│   ├── plan/               # + 打卡连胜卡 / 微训练推荐卡 / 云端状态徽标
│   └── training/           # + ☁️ 云端增强开关与组末复盘
└── test/（仓库根）dailyAndStreak.test.js 等  # 50 条用例
```

## 五、运行测试

```bash
node --test "test/*.test.js"   # 仓库根执行，50 条
```

## 六、可选增强（沿用基座能力）

- **语音命令与播报**：同声传译插件（`wx069ba97219f66d99`），在 `app.json` 加 `plugins` 字段后生效；缺失自动隐藏。启用步骤与微信大赛版相同。
- **云开发多设备同步**：`config.js` 填 `CLOUD_ENV_ID`，创建 `assessments/plans/entitlements/consents/sessions` 集合；未配置自动降级本地。
- **商业化接入（预留）**：本版本不设付费墙；厂商/平台可基于 backend 的 API-key 与用量计量（`/api/usage`）在生态侧接入计费售卖，作品侧零改动。

## 七、真机冒烟清单（录制 demo 前必做）

- [ ] 首页：打卡连胜天数正确；微训练推荐与当前时段相符；云端状态徽标与 backend `/api/status` 一致
- [ ] AI 教练页：未连接云端时显示「本地模板回复」标注且可对话；连接后标注「云端 AI 教练大脑」
- [ ] 训练页：VK 姿态识别计数正确、纠错文案出现；骨架叠加层与身体对齐（如偏移，调整 `vkPoseProvider.js` 的 `FRAME_SCALE_X/Y` 与 `core/poseRules.js` 的 `KEYPOINT_INDEX`，以[官方 Body 检测文档](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/visionkit/body.html)配图为准）
- [ ] ☁️ 云端增强：开启 → 完成一组 → 复盘横幅出现并语音播报
- [ ] 相机拒绝路径、隐私中心撤回、休息日不开训（沿用基座行为）

## 八、已知限制与路线

- `KEYPOINT_INDEX` 采用社区 body-18 布局，真机对照官方配图校准一次（同基座）。
- 云端 ST-GCN 默认关闭（`ENABLE_STGCN` 开关），关闭时云端复盘为桩识别 + LLM 文案，叙事不受影响。
- 决赛路线：AIGC 教练示范视频、微信运动步数卡（`wx.getWeRunData`）、云端公网部署。详见 `competition-tmall/项目方案.md` 第九节。

内容不构成医疗建议。训练量力而行，如有伤痛请先咨询专业医师。
