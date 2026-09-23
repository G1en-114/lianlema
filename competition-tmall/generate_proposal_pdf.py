# -*- coding: utf-8 -*-
"""
生成天猫 AI 黑客松初赛材料：《项目方案》PDF。
排版管线复用微信大赛版验证过的 reportlab + SimHei 方案（中文禁则由 _lint_pdf.py 检查）。
再生成：python generate_proposal_pdf.py（在 backend 依赖之外仅需 reportlab）
"""
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BASE = os.path.dirname(os.path.abspath(__file__))
PDF_PATH = os.path.join(BASE, "项目方案.pdf")

pdfmetrics.registerFont(TTFont("SimHei", "C:/Windows/Fonts/simhei.ttf"))

BRAND = colors.HexColor("#F43F5E")  # 小练 Daily 珊瑚红
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")

S_TITLE = ParagraphStyle("t", fontName="SimHei", fontSize=20, leading=30, textColor=INK, alignment=1, wordWrap="CJK")
S_SUB = ParagraphStyle("s", fontName="SimHei", fontSize=11, leading=18, textColor=MUTED, alignment=1, wordWrap="CJK")
S_H1 = ParagraphStyle("h1", fontName="SimHei", fontSize=13, leading=20, textColor=BRAND, spaceBefore=14, spaceAfter=6, wordWrap="CJK", keepWithNext=1)
S_BODY = ParagraphStyle("b", fontName="SimHei", fontSize=10.5, leading=17, textColor=INK, wordWrap="CJK")
S_LI = ParagraphStyle("li", fontName="SimHei", fontSize=10.5, leading=17, textColor=INK, leftIndent=18, firstLineIndent=-18, wordWrap="CJK")
S_TH = ParagraphStyle("th", fontName="SimHei", fontSize=10, leading=15, textColor=colors.white, wordWrap="CJK")
S_TD = ParagraphStyle("td", fontName="SimHei", fontSize=9.5, leading=14, textColor=INK, wordWrap="CJK")


def h1(text):
    return Paragraph(text, S_H1)


def body(text):
    return Paragraph(text, S_BODY)


def li(text):
    return Paragraph(text, S_LI)


def table(headers, rows, widths):
    data = [[Paragraph(h, S_TH) for h in headers]] + [[Paragraph(c, S_TD) for c in r] for r in rows]
    t = Table(data, colWidths=widths)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BRAND),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FFF1F2")]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


story = []
story.append(Spacer(1, 1.2 * cm))
story.append(Paragraph("小练 Daily · 每天动一动，AI 教练在身边", S_TITLE))
story.append(Spacer(1, 0.3 * cm))
story.append(Paragraph("天猫 AI 黑客松·高校挑战赛 ｜ 智能日常赛道 ｜ 个人参赛 ｜ 项目方案", S_SUB))
story.append(Spacer(1, 0.4 * cm))
story.append(HRFlowable(width="100%", thickness=1.2, color=BRAND))
story.append(Spacer(1, 0.5 * cm))

story.append(h1("一、作品概述"))
story.append(body("小练 Daily 是一个 AI 服务为本体的「每日微训练教练」：手机摄像头就是 AI 教练的眼睛，云端大模型是它的大脑。它不要求用户办卡、买器械、挤出整块时间——而是在每一天的每个时段（晨起、午间、久坐、睡前），用 1-3 分钟的碎片微训练和连续打卡习惯环，把 AI 教练真正放进用户的日常生活，而不只待在聊天框里。"))
story.append(li("作品形态：微信小程序（演示视频 + 可运行原型）+ 云端模型服务（FastAPI）"))
story.append(li("一句话定位：端侧姿态 AI 免费打底、云端大模型按需订阅的随身 AI 教练"))

story.append(h1("二、赛道契合：为什么是「智能日常」"))
story.append(body("赛道原话是「让 AI 真正进入每一天，而不只待在聊天框」，产业灵感方向是手机与穿戴设备。本作品在四个层面直接回应："))
story.append(li("每一天：分时段微训练推荐（按当前时间确定性推荐晨间唤醒、午间激活、久坐办公桌拉伸、睡前放松），连续打卡连胜天数可视化——AI 出现在用户的每一天，而非只在训练日。"))
story.append(li("不只待在聊天框：AI 教练通过手机摄像头看着用户训练（端侧识别 + 实时纠错 + 语音口令），还会在每组结束后主动给出云端复盘，而不是等用户来提问。"))
story.append(li("手机与穿戴设备：全部 AI 能力跑在用户随身设备上（小程序 + 手机摄像头 + 麦克风语音命令）；决赛路线图包含微信运动步数联动。"))
story.append(li("习惯环闭环：微训练（1 分钟）→ 打卡 → 连胜天数 → AI 教练对话引用连胜事实个性化激励 → 次日推荐。"))

story.append(h1("三、用户痛点与方案"))
story.append(table(
    ["痛点", "现状", "小练 Daily 的答案"],
    [
        ["健身 App 门槛高", "要器械、要整块时间、要自律", "1-3 分钟微训练 + 零器械 + 分时段推荐"],
        ["聊天框 AI 只会说不会看", "用户比划错了它不知道", "摄像头姿态识别实时纠错，眼睛和大脑都有"],
        ["私教太贵", "线下一节课数百元", "AI 教练按月订阅 29 元，加油包 9.9 元"],
        ["运动 App 不懂你", "千人一面课表", "评估→确定性计划→LLM 解释为什么适合你"],
    ],
    [4.2 * cm, 5.6 * cm, 6.8 * cm],
))

story.append(h1("四、AI 架构：三层 AI，服务可售卖（核心创新）"))
story.append(body("L1 端侧 AI（免费层，隐私优先）：微信 VisionKit VKSession 人体检测在设备上输出关键点，确定性角度规则实时判定动作标准度与计数，视频帧不出设备。"))
story.append(body("L2 云端视觉模型服务（付费层，自研模型服务化）：自研 RTMPose + ST-GCN 动作识别（仓库内自训模型，11 类健身动作）包装为 POST /api/vision/analyze：端侧上传关键点序列（非视频，隐私友好），云端返回动作类别、置信度与标准度；确定性深蹲角度规则产出标准度判定；多模态 VLM 顾问（OpenAI 兼容协议，Qwen-VL、GLM-4V 可插拔）给出训练快照的文字评述。"))
story.append(body("L3 LLM 教练大脑（付费层）：OpenAI 兼容协议接入 Qwen、DeepSeek、GLM 或本地 Ollama，驱动 AI 教练对话页、计划个性化解释与组末复盘；LLM 不可用时确定性模板兜底。"))
story.append(body("安全红线（工程可信度）：动作分、计数、标准度等数值永远出自模型或确定性规则，LLM 与 VLM 只消费结构化事实产文案；任何模型故障（无密钥、网络、解析失败）自动降级，服务永不 5xx。"))

story.append(h1("五、模型服务商业模式（把模型卖给用户）"))
story.append(table(
    ["套餐", "价格", "内容"],
    [
        ["免费版", "0 元 永久", "端侧姿态识别与纠错、7 天计划与打卡、AI 教练每日 3 问"],
        ["Pro 订阅", "29 元/月", "云端 ST-GCN 识别、VLM 快照分析、AI 教练无限对话、报告深度解读"],
        ["按次加油包", "9.9 元/10 次", "云端动作分析按次购买，不过期"],
    ],
    [3.4 * cm, 3.2 * cm, 10.0 * cm],
))
story.append(body("配套数据面已实现：API-key 鉴权 + SQLite 用量计量（GET /api/usage 按次与 token 汇总），小程序套餐页实时拉取云端目录并展示云端额度余额；演示环境为合规明示的模拟解锁，正式版替换为微信支付或支付宝凭证校验即可。"))

story.append(h1("六、完成度与验证"))
story.append(li("小程序 8 个页面全部可运行（新增 AI 教练对话页）；零配置可编译，未连接云端时所有 AI 入口自动降级并有明确标注。"))
story.append(li("模型服务 6 组 API（analyze、chat、plan_explain、usage、tiers、status）全部实现并带测试。"))
story.append(li("测试：Node 端 50 条用例（计划生成、姿态规则、动作分、语音意图、权益、打卡连胜、微训练推荐、COCO 重排）+ 后端 pytest 70 条，全部通过。"))
story.append(li("演示路径：backend 启动 uvicorn → 小程序 config.js 填 MODEL_SERVICE_BASE_URL → 真机或开发者工具全流程演示。"))

story.append(h1("七、差异化对比"))
story.append(li("对比 Keep 等健身 App：无免费端侧 AI 纠错层、无对话式教练、无云端模型服务化售卖。"))
story.append(li("对比通用 AI 助手（聊天框）：看不见动作、无确定性数值能力、无习惯环。"))
story.append(li("对比私教：价格约为五十分之一，且全天候在身边。"))

story.append(h1("八、原创性与基座披露"))
story.append(body("参赛者为开源项目 github.com/Health-525/lian_le_ma（MIT 协议，本人作品）的维护者。本项目以该仓库的模型层（自训 RTMPose + ST-GCN）为基座，为本赛事全新开发了：云端模型服务层、小程序 AI 教练对话页、云端增强链路、云端额度权益体系、打卡连胜与分时段微训练、品牌与视觉系统。同一基座存在另一差异化参赛版本（微信小程序大赛，工具方向），两版本的产品定位、功能集与代码分支完全独立。"))

story.append(h1("九、决赛 48 小时路线图"))
story.append(li("AIGC 加分项：AI 生成教练示范视频与数字人教练形象（接入视频生成 API，Pro 会员卖点）。"))
story.append(li("微信运动步数卡：穿戴数据触发微训练推荐，无授权自动隐藏。"))
story.append(li("真实支付接入评估与云端部署（模型服务公网可达 + 人气评选试用通道）。"))
story.append(li("端云延迟对比演示（同一动作端侧与云端双轨展示）；真机 ST-GCN 冒烟与动作库扩充。"))

story.append(h1("十、团队"))
story.append(body("刘宇轩，太原理工大学，个人参赛。负责全部产品设计、开发与模型训练；开发过程使用 AI 辅助编程（代码与文档均经人工审校，测试全部通过）。"))

doc = SimpleDocTemplate(
    PDF_PATH, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
    title="小练 Daily · 项目方案", author="刘宇轩",
)
doc.build(story)
print("PDF written:", PDF_PATH)
