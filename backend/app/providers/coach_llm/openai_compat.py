"""OpenAI 兼容协议的 LLM 教练实现。

一个实现覆盖 Qwen（DashScope 兼容模式）/ DeepSeek / GLM / 本地 Ollama 等所有
OpenAI 风格 ``/chat/completions`` 端点：只换 ``LLM_API_BASE`` + ``LLM_MODEL`` + key。
结构化输出靠提示词约束 + JSON 容错解析，失败抛异常由责任链降级。
"""

from __future__ import annotations

import json

import httpx

from app.core.config import get_settings

from .base import CoachContext, CoachReply

SYSTEM_PROMPT = """你是「小练 Daily」小程序里的 AI 健身教练大脑，和用户日常对话。
铁律：
1. 不编造训练数据：只能引用 context 中给出的结构化事实（今日计划、最近报告、动作名、连续打卡天数）。
2. 不做医疗诊断或治疗建议；用户提到疼痛时，建议降低强度并就医。
3. 不评判用户身材或外貌，只谈动作与训练安排。
4. 只输出一个 JSON 对象：{"reply": "...", "suggestions": ["...", "..."]}。
   reply 不超过 120 个汉字；suggestions 最多 3 条，每条不超过 30 个汉字。
5. 全程使用中文，语气鼓励、口语化、不啰嗦。"""


def _extract_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no json object in llm response")
    return json.loads(cleaned[start : end + 1])


class OpenAICompatCoach:
    """OpenAI 兼容端点的教练实现。"""

    name = "llm"

    def __init__(self, timeout: float = 30.0) -> None:
        self._timeout = timeout

    def available(self) -> bool:
        s = get_settings()
        return bool(s.LLM_API_KEY and s.LLM_API_BASE)

    def chat(self, messages: list[dict], context: CoachContext) -> CoachReply:
        s = get_settings()
        context_lines = []
        if context.today_plan:
            context_lines.append(f"今日计划：{context.today_plan}")
        if context.latest_report:
            context_lines.append(f"最近训练报告：{context.latest_report}")
        if context.exercise:
            context_lines.append(f"当前动作：{context.exercise}")
        if context.streak_days is not None:
            context_lines.append(f"连续打卡：{context.streak_days} 天")
        context_block = "结构化事实（只能引用这些，不得编造其他数据）：\n" + "\n".join(
            context_lines
        ) if context_lines else "（暂无训练数据）"

        payload_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        payload_messages.append({"role": "system", "content": context_block})
        # 历史只保留最近 8 条，控制 token 成本。
        payload_messages.extend(messages[-8:])

        payload = {"model": s.LLM_MODEL, "messages": payload_messages}
        headers = {"Authorization": f"Bearer {s.LLM_API_KEY}"}
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(f"{s.LLM_API_BASE}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            body = resp.json()

        text = body["choices"][0]["message"]["content"]
        parsed = _extract_json(text)
        suggestions = [str(x) for x in (parsed.get("suggestions") or [])][:3]
        tokens = int(body.get("usage", {}).get("total_tokens") or 0)
        return CoachReply(
            reply=str(parsed.get("reply") or text.strip()),
            suggestions=suggestions,
            source="llm",
            tokens=tokens,
        )
