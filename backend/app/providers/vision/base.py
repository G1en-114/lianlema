"""视觉分析提供方契约（模型服务版）。

天猫黑客松定制款的三层视觉 AI：

1. ``VlmAdvisor`` —— 多模态大模型（OpenAI 兼容协议，Qwen-VL / GLM-4V 等），
   消费训练快照图像，输出文字动作评述；未配置密钥时自动跳过。
2. ``StgcnFrameAnalyzer`` —— 自研 ST-GCN 动作识别（``src/fitness_infer.py`` 服务化封装），
   消费 COCO-17 关键点帧序列；checkpoint 或 torch 缺失时自动降级。
3. ``StubVisionAnalyzer`` —— 确定性桩，保证演示与测试永不中断。

安全红线：识别置信度、角度判定等数值只来自模型或确定性规则；
VLM 输出的文字评述不参与任何计分。
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field


class ProblemArea(BaseModel):
    """动作问题部位（确定性规则产出）。"""

    area: str
    detail: str


class FormAssessment(BaseModel):
    """动作标准度评估。"""

    is_standard: bool
    confidence: str = "medium"  # low | medium | high
    problem_areas: list[ProblemArea] = Field(default_factory=list)
    note: str = ""


class VisionAnalysisResult(BaseModel):
    """视觉分析接口的统一输出。"""

    provider: str  # "stgcn" | "stub"
    action: str | None = None
    action_confidence: float = 0.0
    form: FormAssessment
    coach_hint: str = ""
    vlm_assessment: str | None = None


# COCO-17 关键点下标（与 src/fitness_infer.FITNESS_LABELS 训练格式一致）。
COCO_KEYPOINT_NAMES = (
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
)


@runtime_checkable
class FrameAnalyzer(Protocol):
    """关键点序列动作识别契约。"""

    name: str

    def available(self) -> bool: ...

    def analyze_frames(
        self, frames: list[list[list[float]]], exercise_hint: str | None
    ) -> VisionAnalysisResult: ...


@runtime_checkable
class ImageAdvisor(Protocol):
    """训练快照图像评述契约（多模态大模型）。"""

    name: str

    def available(self) -> bool: ...

    def advise_image(self, image_base64: str, exercise_hint: str | None) -> dict: ...
