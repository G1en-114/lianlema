"""确定性模板教练：LLM 不可用时的兜底。

只消费 ``CoachContext`` 中的结构化事实，输出固定句式，
不依赖任何外部服务，保证演示与测试确定性。
"""

from __future__ import annotations

from .base import CoachContext, CoachReply

_DEFAULT_SUGGESTIONS = [
    "训练前热身 2 分钟",
    "动作宁慢勿快，保持呼吸",
    "训练后补充水分并拉伸",
]


class TemplateCoach:
    """模板兜底实现。"""

    name = "template"

    def __init__(self) -> None:
        self.last_fallback_reason: str | None = None

    def available(self) -> bool:
        return True

    def chat(self, messages: list[dict], context: CoachContext) -> CoachReply:
        parts: list[str] = []
        if context.streak_days is not None and context.streak_days > 0:
            parts.append(f"你已经连续打卡 {context.streak_days} 天，保持这个节奏！")
        if context.today_plan:
            parts.append(f"今天的计划是：{context.today_plan}。")
        if context.latest_report:
            parts.append(f"上次训练：{context.latest_report}")
        if context.exercise:
            parts.append(f"做 {context.exercise} 时注意动作幅度，觉得吃力就降低难度。")
        if not parts:
            parts.append("今天还没安排训练，从 1 分钟微训练开始也不错。")

        return CoachReply(
            reply="".join(parts),
            suggestions=list(_DEFAULT_SUGGESTIONS),
            source="template",
            tokens=0,
        )
