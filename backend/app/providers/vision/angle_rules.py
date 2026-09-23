"""确定性角度规则：动作标准度判定的规则层。

移植自小程序端 ``core/poseRules.js`` 的设计思路（关节角判定），
服务端版本只覆盖深蹲深度一条规则作为 v1；数值判定完全确定性、可单测。
"""

from __future__ import annotations

from .base import FormAssessment, ProblemArea

# COCO-17 下标：髋 11/12，膝 13/14，踝 15/16。
_LEFT_HIP, _RIGHT_HIP = 11, 12
_LEFT_KNEE, _RIGHT_KNEE = 13, 14
_LEFT_ANKLE, _RIGHT_ANKLE = 15, 16

# 深蹲达标线：最深帧膝角（髋-膝-踝）应小于该值（度）。
SQUAT_MAX_KNEE_ANGLE = 110.0


def _midpoint(frame: list[list[float]], i: int, j: int) -> tuple[float, float]:
    a, b = frame[i], frame[j]
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def _angle_at_b(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    """向量 BA 与 BC 的夹角（度）。"""
    v1 = (a[0] - b[0], a[1] - b[1])
    v2 = (c[0] - b[0], c[1] - b[1])
    dot = v1[0] * v2[0] + v1[1] * v2[1]
    n1 = (v1[0] ** 2 + v1[1] ** 2) ** 0.5
    n2 = (v2[0] ** 2 + v2[1] ** 2) ** 0.5
    if n1 < 1e-9 or n2 < 1e-9:
        return 180.0
    cos = max(-1.0, min(1.0, dot / (n1 * n2)))
    import math

    return math.degrees(math.acos(cos))


def min_knee_angle(frames: list[list[list[float]]]) -> float | None:
    """整段序列中最深处的膝角（度）；帧为空或关键点全零时返回 None。"""
    angles: list[float] = []
    for frame in frames:
        if len(frame) < 17:
            continue
        hip = _midpoint(frame, _LEFT_HIP, _RIGHT_HIP)
        knee = _midpoint(frame, _LEFT_KNEE, _RIGHT_KNEE)
        ankle = _midpoint(frame, _LEFT_ANKLE, _RIGHT_ANKLE)
        if hip == knee or knee == ankle:
            continue  # 关键点缺失/全零帧
        angles.append(_angle_at_b(hip, knee, ankle))
    return min(angles) if angles else None


def _action_matches(action: str | None, hint: str | None) -> bool:
    """ST-GCN 标签（复数，如 squats）与客户端动作名（squat）的对齐。"""
    if action is None or hint is None:
        return True  # 无 hint 时不惩罚
    return action == hint or action.rstrip("s") == hint.rstrip("s")


def assess_form(
    frames: list[list[list[float]]],
    action: str | None,
    exercise_hint: str | None,
    action_confidence: float,
) -> FormAssessment:
    """综合动作识别结果与角度规则，产出确定性的标准度评估。"""
    problems: list[ProblemArea] = []

    if action in ("squats",) or (exercise_hint or "").startswith("squat"):
        knee = min_knee_angle(frames)
        if knee is None:
            return FormAssessment(
                is_standard=False,
                confidence="low",
                note="下肢关键点缺失，无法完成深度判定",
            )
        if knee > SQUAT_MAX_KNEE_ANGLE:
            problems.append(
                ProblemArea(
                    area="knee",
                    detail=f"下蹲深度不足（最深膝角 {knee:.0f}° > {SQUAT_MAX_KNEE_ANGLE:.0f}°），建议蹲至大腿约与地面平行",
                )
            )

    if not _action_matches(action, exercise_hint):
        problems.append(
            ProblemArea(
                area="action",
                detail=f"识别到的动作（{action}）与计划的动作（{exercise_hint}）不一致，请对照示范调整",
            )
        )

    confidence = "high" if action_confidence >= 0.7 else "medium"
    return FormAssessment(
        is_standard=not problems,
        confidence=confidence,
        problem_areas=problems,
    )
