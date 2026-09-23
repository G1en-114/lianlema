# 小练 Daily

> 每天动一动，AI 教练在身边。

**天猫 AI 黑客松·高校挑战赛**（智能日常赛道）参赛作品：一个 **AI 服务为本体**的「每日微训练教练」。基于开源基座 [Health-525/lian_le_ma](https://github.com/Health-525/lian_le_ma)（本人作品，MIT）的模型层演进，为本赛事定制开发。

## 产品一句话

端侧姿态 AI 免费打底、云端大模型按需订阅的随身 AI 教练——AI 不只待在聊天框里：它通过手机摄像头**看着**你训练、在每个时段推荐 1-3 分钟微训练、用连续打卡习惯环陪你把运动变成日常。

## 三层 AI 架构（核心）

| 层 | 能力 | 实现 | 售卖 |
|----|------|------|------|
| L1 端侧 AI | 姿态识别 + 实时动作纠错（视频不出设备） | `miniprogram/` VKSession + 确定性角度规则 | 免费层 |
| L2 云端视觉模型 | 自研 ST-GCN 动作识别（11 类）+ 确定性深蹲规则 + VLM 快照评述 | `backend/app/providers/vision/` | 付费层 |
| L3 LLM 教练大脑 | 对话 / 计划解释 / 组末复盘（OpenAI 兼容：Qwen/DeepSeek/GLM/Ollama） | `backend/app/providers/coach_llm/` | 付费层 |

**安全红线**：动作分、计数、标准度等数值永远出自模型或确定性规则；LLM/VLM 只消费结构化事实产文案；任何模型故障自动降级，服务永不 5xx。

## 目录

| 目录 | 说明 |
|------|------|
| `miniprogram/` | 微信小程序（8 页面：计划/AI 教练对话/训练/报告/记录/我的/评估/AI 模型服务套餐） |
| `backend/` | FastAPI 模型服务（6 组 API：analyze / chat / plan_explain / usage / tiers / status + 用量计量） |
| `competition-tmall/` | 初赛材料：项目方案 PDF（可再生成）、demo 录屏分镜脚本 |
| `src/`、`model/` | 基座模型层：RTMPose + ST-GCN（自训模型与训练管线） |
| `app/`、`doc/` 等 | 基座仓库的 RN App 与模型文档（本定制款未改动） |

## 快速开始

### 1. 小程序（零配置可跑）

微信开发者工具导入 `miniprogram/` 目录，AppID 选「测试号」，编译即运行。未连接云端时，所有 AI 入口自动降级并明确标注（AI 教练页走本地模板回复）。

### 2. 云端模型服务

```bash
cd backend
cp .env.example .env      # 填 LLM_API_KEY（Qwen/DeepSeek/GLM/Ollama 任一 OpenAI 兼容端点）
pip install -e ".[test]"  # 或按 pyproject 安装依赖
uvicorn app.main:app --port 8000
```

### 3. 连接两者

`miniprogram/config.js`：

```js
MODEL_SERVICE_BASE_URL: 'http://<电脑局域网IP>:8000',  // 真机需同 WiFi
MODEL_SERVICE_API_KEY: '',                              // backend 配置 MODEL_SERVICE_API_KEYS 后填写
```

打开训练页的「☁️ 云端 AI 增强」开关即可体验付费模型服务链路；`ENABLE_STGCN=1`（需健康 torch 环境）开启自研 ST-GCN 识别，详见 `backend/.env.example`。

## 测试

```bash
node --test "test/*.test.js"          # 小程序核心层 50 条（计划/姿态/权益/打卡/微训练/重排）
cd backend && python -m pytest tests/ # 模型服务 70 条（API/降级/计量/鉴权/角度规则）
```

## 商业模式：模型即服务

免费版（端侧 + 每日 3 问）→ Pro 订阅 ¥29/月（云端不限次）→ 按次加油包 ¥9.9/10 次。
计费数据面：API-key 鉴权 + SQLite 用量计量；演示环境为合规明示的模拟解锁，正式版替换微信支付/支付宝凭证校验即可。

## 与基座/其他参赛版的关系

本仓库从 `Health-525/lian_le_ma` 克隆，保留其模型层（`src/`、`model/`）作为 L2 的模型来源；`miniprogram/` 基线同步自同仓库的微信大赛参赛版，此后两分支产品定位、功能集与代码完全独立（本版：AI 服务 + 智能日常；微信版：健身工具 + 效率类目）。品牌差异：小练 Daily / 珊瑚红（回切开关见 `miniprogram/app.wxss` 首行注释）。

## License

MIT（基座协议沿用）
