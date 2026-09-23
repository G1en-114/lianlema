"""模型服务路由（天猫黑客松「小练 Daily」AI 服务版）。

对外五组接口：
- ``POST /api/vision/analyze``  云端动作分析（ST-GCN 关键点识别 + 可选 VLM 快照评述）
- ``POST /api/coach/chat``      LLM 教练对话（模板兜底）
- ``POST /api/plan/explain``    计划个性化解释（同教练链）
- ``GET  /api/usage``           用量查询（按 API-key 汇总，为后续计费售卖预留数据面）
- ``GET  /api/status``          服务能力状态

商业化定位：本作品只提供模型能力与计量数据面，不做定价与收费——
计费售卖由平台/厂商在生态侧接入（API-key + usage 即接入点）。

设计红线：任何模型故障都降级为桩/模板而非 5xx；
数值只出自模型或确定性规则，LLM/VLM 文字不参与计分。
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.providers.coach_llm import CoachChain, CoachContext
from app.providers.vision import (
    StgcnFrameAnalyzer,
    StubVisionAnalyzer,
    VlmAdvisor,
    VisionAnalysisResult,
)
from app.services.metering import get_meter

router = APIRouter(prefix="/api", tags=["model-service"])

# 进程级单例：惰性加载，各 provider 自行判断可用性。
_stgcn = StgcnFrameAnalyzer()
_vlm = VlmAdvisor()
_coach = CoachChain()


# ---- 请求模型 ----


class VisionAnalyzeRequest(BaseModel):
    """云端动作分析请求。

    ``frames`` 为 COCO-17 关键点序列（[帧数][17][2]，与 ST-GCN 训练格式一致）；
    ``image_base64`` 为可选训练快照，配置了 VLM 密钥时产出文字评述。
    """

    exercise: str | None = None
    frames: list[list[list[float]]] = Field(default_factory=list)
    image_base64: str | None = None


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class CoachChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: CoachContext = Field(default_factory=CoachContext)


class PlanExplainRequest(BaseModel):
    plan_summary: str
    assessment: str | None = None


# ---- 鉴权 ----


def require_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> str:
    """模型服务 API-key 鉴权。

    未配置 ``MODEL_SERVICE_API_KEYS`` 时为开发模式：放行并归到 ``dev`` 账户
    （``/api/status`` 会标注 auth=disabled-dev，生产/演示前必须配置）。
    """
    configured = [
        key.strip()
        for key in (get_settings().MODEL_SERVICE_API_KEYS or "").split(",")
        if key.strip()
    ]
    if not configured:
        return "dev"
    if x_api_key in configured:
        return x_api_key
    raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")


# ---- 接口 ----


@router.post("/vision/analyze", response_model=VisionAnalysisResult)
def vision_analyze(
    req: VisionAnalyzeRequest, api_key: str = Depends(require_api_key)
) -> VisionAnalysisResult:
    """云端动作分析：ST-GCN 关键点识别 + 确定性角度规则 + 可选 VLM 评述。"""
    update: dict = {}
    if _stgcn.available():
        try:
            result = _stgcn.analyze_frames(req.frames, req.exercise)
        except Exception as exc:  # noqa: BLE001 - 模型运行期故障降级到桩
            result = StubVisionAnalyzer(f"{type(exc).__name__}").analyze_frames(
                req.frames, req.exercise
            )
    else:
        result = StubVisionAnalyzer(_stgcn.disabled_reason()).analyze_frames(
            req.frames, req.exercise
        )

    if req.image_base64 and _vlm.available():
        try:
            advised = _vlm.advise_image(req.image_base64, req.exercise)
            if advised.get("assessment"):
                update["vlm_assessment"] = advised["assessment"]
        except Exception:  # noqa: BLE001 - VLM 故障只影响评述，不影响主结果
            update["vlm_assessment"] = None

    if update:
        result = result.model_copy(update=update)
    get_meter().record(api_key, "vision")
    return result


@router.post("/coach/chat")
def coach_chat(req: CoachChatRequest, api_key: str = Depends(require_api_key)):
    """LLM 教练对话；LLM 不可用时模板兜底（source 字段标明来源）。"""
    reply = _coach.chat([m.model_dump() for m in req.messages], req.context)
    get_meter().record(api_key, "coach", tokens=reply.tokens)
    return reply


@router.post("/plan/explain")
def plan_explain(req: PlanExplainRequest, api_key: str = Depends(require_api_key)):
    """计划个性化解释：让用户明白「为什么今天的计划适合我」。"""
    context = CoachContext(today_plan=req.plan_summary, latest_report=req.assessment)
    messages = [
        {
            "role": "user",
            "content": "请用两三句话解释为什么今天的训练计划适合我，并给出一条今天执行时的建议。",
        }
    ]
    reply = _coach.chat(messages, context)
    get_meter().record(api_key, "plan", tokens=reply.tokens)
    return reply


@router.get("/usage")
def usage(api_key: str = Depends(require_api_key)):
    """按 API-key 的用量汇总（调用量 + token）：为后续计费售卖预留的数据面。"""
    return get_meter().summary(api_key)


@router.get("/status")
def status():
    """服务能力状态矩阵：小程序据此展示「云端 AI」可用性。"""
    configured = bool(
        [
            k.strip()
            for k in (get_settings().MODEL_SERVICE_API_KEYS or "").split(",")
            if k.strip()
        ]
    )
    return {
        "stgcn": _stgcn.available(),
        "vlm": _vlm.available(),
        "llm": bool(get_settings().LLM_API_KEY and get_settings().LLM_API_BASE),
        "auth": "enabled" if configured else "disabled-dev",
    }
