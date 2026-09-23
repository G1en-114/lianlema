"""教练大脑提供方：契约、OpenAI 兼容实现、模板兜底与责任链。"""

from __future__ import annotations

from .base import CoachContext, CoachLLM, CoachReply
from .openai_compat import OpenAICompatCoach
from .template import TemplateCoach


class CoachChain:
    """LLM 优先、模板兜底的责任链。

    LLM 可用则调用之；任何失败（网络/解析/超时）自动落到模板，
    并记录降级原因，服务永不因大模型故障而 5xx。
    """

    name = "coach-chain"

    def __init__(self, llm: OpenAICompatCoach | None = None) -> None:
        self._llm = llm or OpenAICompatCoach()
        self._fallback = TemplateCoach()
        self.last_fallback_reason: str | None = None

    def available(self) -> bool:
        return True  # 链整体永远可用（模板兜底）

    def chat(self, messages: list[dict], context: CoachContext) -> CoachReply:
        self.last_fallback_reason = None
        if self._llm.available():
            try:
                return self._llm.chat(messages, context)
            except Exception as exc:  # noqa: BLE001 - 大模型故障一律降级
                self.last_fallback_reason = f"{type(exc).__name__}: {exc}"
        else:
            self.last_fallback_reason = "llm not configured"
        return self._fallback.chat(messages, context)


__all__ = ["CoachContext", "CoachLLM", "CoachReply", "OpenAICompatCoach", "TemplateCoach", "CoachChain"]
