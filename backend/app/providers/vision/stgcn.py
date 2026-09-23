"""自研 ST-GCN 动作识别的云端服务化封装。

对 ``src/fitness_infer.load_fitness_action_recognizer`` 的薄包装：
- 惰性加载：首次调用时才把仓库根加入 ``sys.path`` 并加载 checkpoint，
  torch / numpy / checkpoint 任一缺失时 ``available()`` 返回 False，路由层自动降级到桩。
- 仓库根目录按 ``backend/app/providers/vision/stgcn.py`` 的相对层级推算，
  与启动时的工作目录无关。
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.core.config import get_settings

from .angle_rules import assess_form
from .base import FormAssessment, VisionAnalysisResult

# backend/app/providers/vision/stgcn.py → parents[4] 即仓库根。
_REPO_ROOT = Path(__file__).resolve().parents[4]


class StgcnFrameAnalyzer:
    """ST-GCN 关键点序列动作识别（自有模型服务）。"""

    name = "stgcn"

    def __init__(self, checkpoint: str | None = None) -> None:
        self._checkpoint_override = checkpoint
        self._recognizer = None
        self._load_error: str | None = None

    # ---- 加载 ----

    def available(self) -> bool:
        """是否尝试加载并使用 ST-GCN。

        需要显式置 ``ENABLE_STGCN=1``：个别 torch/numpy 环境下模型构造会
        触发底层原生崩溃（无法用异常捕获），默认关闭以保证服务进程稳定。
        """
        if not get_settings().ENABLE_STGCN:
            return False
        return self._load() is not None

    def disabled_reason(self) -> str:
        if not get_settings().ENABLE_STGCN:
            return "ENABLE_STGCN 未开启（默认关闭，保证进程稳定）"
        return self.load_error() or "未知原因"

    def load_error(self) -> str | None:
        return self._load_error

    def _load(self):
        if self._recognizer is not None:
            return self._recognizer
        if self._load_error is not None:
            return None
        try:
            repo_root = str(_REPO_ROOT)
            if repo_root not in sys.path:
                sys.path.insert(0, repo_root)
            from src.fitness_infer import load_fitness_action_recognizer

            raw = self._checkpoint_override or get_settings().STGCN_CHECKPOINT
            path = Path(raw)
            if not path.is_absolute():
                path = _REPO_ROOT / path
            recognizer = load_fitness_action_recognizer(path)
            if recognizer is None:
                raise FileNotFoundError(str(path))
            self._recognizer = recognizer
        except Exception as exc:  # noqa: BLE001 - 任何加载失败都降级，不阻断服务
            self._load_error = f"{type(exc).__name__}: {exc}"
        return self._recognizer

    # ---- 分析 ----

    def analyze_frames(
        self, frames: list[list[list[float]]], exercise_hint: str | None
    ) -> VisionAnalysisResult:
        recognizer = self._load()
        if recognizer is None:
            raise RuntimeError(f"stgcn unavailable: {self._load_error}")

        recognizer.reset()
        last: dict | None = None
        for keypoints in frames:
            result = recognizer.push_frame(keypoints)
            if result is not None:
                last = result

        if last is None:
            return VisionAnalysisResult(
                provider=self.name,
                action=None,
                action_confidence=0.0,
                form=FormAssessment(
                    is_standard=False,
                    confidence="low",
                    note="关键点帧数不足一个识别窗口（48 帧），无法给出结论",
                ),
            )

        form = assess_form(frames, last["action"], exercise_hint, last["confidence"])
        return VisionAnalysisResult(
            provider=self.name,
            action=last["action"],
            action_confidence=round(float(last["confidence"]), 4),
            form=form,
        )


class StubVisionAnalyzer:
    """确定性桩：模型不可用时的兜底，保证接口永不 5xx。"""

    name = "stub"

    def __init__(self, reason: str = "模型未加载（演示桩兜底）") -> None:
        self.reason = reason

    def available(self) -> bool:
        return True

    def analyze_frames(
        self, frames: list[list[list[float]]], exercise_hint: str | None
    ) -> VisionAnalysisResult:
        return VisionAnalysisResult(
            provider=self.name,
            action=None,
            action_confidence=0.0,
            form=FormAssessment(
                is_standard=False,
                confidence="low",
                note=f"云端 ST-GCN 不可用：{self.reason}；请依赖端侧判定",
            ),
        )
