"""多模态大模型顾问（OpenAI 兼容协议）。

通过 ``/chat/completions`` 的 ``image_url``（base64 data URL）消息，
请求 Qwen-VL / GLM-4V 等多模态模型对训练快照做文字评述。
密钥缺失时 ``available()`` 为 False，调用方自动跳过——
评述永远只是文字建议，不参与任何计分（安全红线）。
"""

from __future__ import annotations

import json

import httpx

from app.core.config import get_settings

_PROMPT_TEMPLATE = (
    "你是健身动作分析专家。请分析这张训练快照中用户的动作姿态，"
    "只输出一个 JSON 对象：{{\"action\": \"识别到的动作英文名或 unknown\","
    " \"assessment\": \"两句话以内的中文动作评述，指出一个最值得改进的点\"}}。"
    "不要输出 JSON 以外的任何内容。"
    "{hint_line}"
)


def _extract_json(text: str) -> dict:
    """容忍 ```json 围栏与前后杂讯，提取首个 JSON 对象。"""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no json object in vlm response")
    return json.loads(cleaned[start : end + 1])


class VlmAdvisor:
    """OpenAI 兼容多模态视觉顾问。"""

    name = "vlm"

    def __init__(self, timeout: float = 30.0) -> None:
        self._timeout = timeout

    def _settings(self):
        return get_settings()

    def available(self) -> bool:
        s = self._settings()
        return bool(s.VLM_API_KEY and s.VLM_API_BASE)

    def advise_image(self, image_base64: str, exercise_hint: str | None) -> dict:
        """返回 ``{"action": str, "assessment": str}``；失败抛异常由调用方降级。"""
        s = self._settings()
        hint_line = f"用户正在做 {exercise_hint}。" if exercise_hint else ""
        payload = {
            "model": s.VLM_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _PROMPT_TEMPLATE.format(hint_line=hint_line)},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                        },
                    ],
                }
            ],
        }
        headers = {"Authorization": f"Bearer {s.VLM_API_KEY}"}
        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(f"{s.VLM_API_BASE}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            body = resp.json()

        text = body["choices"][0]["message"]["content"]
        parsed = _extract_json(text)
        return {
            "action": str(parsed.get("action") or "unknown"),
            "assessment": str(parsed.get("assessment") or ""),
        }
