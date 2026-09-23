"""LLM 教练大脑契约。

设计要点（对应「小练 Daily」AI 服务版）：
- 输出为结构化 ``CoachReply``：回复正文 + 最多 3 条建议 + 来源标记。
- LLM 不可用（无密钥 / 网络失败 / 输出解析失败）时由确定性模板兜底，
  服务永不因大模型故障而 5xx。
- 铁律（继承自教练人设「小练」）：不编造训练数据、不做医疗建议、
  不评判外形；回复只能引用 context 给出的结构化事实。
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from pydantic import BaseModel, Field


class CoachContext(BaseModel):
    """随对话下发的结构化事实（LLM 只能引用这里的数据，不得编造）。"""

    today_plan: str | None = None
    latest_report: str | None = None
    exercise: str | None = None
    streak_days: int | None = None


class CoachReply(BaseModel):
    """教练回复的统一结构。"""

    reply: str
    suggestions: list[str] = Field(default_factory=list)
    source: str = "template"  # "llm" | "template"
    tokens: int = 0


@runtime_checkable
class CoachLLM(Protocol):
    """教练大脑契约。"""

    name: str

    def available(self) -> bool: ...

    def chat(self, messages: list[dict], context: CoachContext) -> CoachReply: ...
