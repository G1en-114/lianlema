"""应用配置加载。

使用 python-dotenv 加载 `.env` 中的环境变量，并以 Pydantic ``Settings`` 模型
对其建模。设计要点：

- 导入本模块不会因缺少第三方密钥而崩溃；密钥可选，缺失时为 ``None``。
- 真正使用密钥时由 :class:`app.core.secrets.SecretManager` 负责报错（503）。
- ``get_settings()`` 提供带 ``lru_cache`` 的单例访问方式。
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel

# 开发环境默认使用本地 SQLite（需求 11.4）。
DEFAULT_DATABASE_URL = "sqlite:///./dev.db"


class Settings(BaseModel):
    """应用运行所需的配置项。

    第三方凭证均为可选：缺失时保持 ``None``，不在加载阶段抛错，
    仅当通过 :class:`app.core.secrets.SecretManager` 实际取用时才会报缺失错误。
    模型服务（黑客松定制款）相关配置同样遵循「缺配置自动降级」原则。
    """

    DATABASE_URL: str = DEFAULT_DATABASE_URL
    OPENROUTER_API_KEY: str | None = None
    ELEVENLABS_API_KEY: str | None = None

    # ---- 模型服务（天猫黑客松「小练 Daily」AI 服务版） ----
    # LLM 教练大脑：OpenAI 兼容端点（Qwen/DeepSeek/GLM/Ollama 均可）。
    LLM_API_BASE: str | None = None
    LLM_API_KEY: str | None = None
    LLM_MODEL: str = "qwen-plus"
    # 多模态视觉顾问：OpenAI 兼容多模态端点（Qwen-VL/GLM-4V 等）。
    VLM_API_BASE: str | None = None
    VLM_API_KEY: str | None = None
    VLM_MODEL: str = "qwen-vl-plus"
    # 自研 ST-GCN 动作识别 checkpoint（相对仓库根）。
    # 加载 ST-GCN 需要健康的 torch+numpy 环境（个别环境下底层库会原生崩溃），
    # 因此默认关闭、显式开启：置 ENABLE_STGCN=1 且确保 checkpoint 可加载。
    STGCN_CHECKPOINT: str = "model/bestbest/best_model_2.pth"
    ENABLE_STGCN: bool = False
    # 模型服务 API keys（逗号分隔）；未配置 = 开发模式放行（响应中标注）。
    MODEL_SERVICE_API_KEYS: str | None = None
    # 用量计量库（SQLite 文件路径）。
    MODEL_SERVICE_DB: str = "model_usage.db"


def _from_environment() -> Settings:
    """从进程环境变量构建 ``Settings``。

    空字符串视为未配置（归一化为 ``None``），避免 ``.env`` 占位空值被误判为有值。
    """

    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    def _clean_with_default(value: str | None, default: str) -> str:
        return _clean(value) or default

    return Settings(
        DATABASE_URL=_clean(os.getenv("DATABASE_URL")) or DEFAULT_DATABASE_URL,
        OPENROUTER_API_KEY=_clean(os.getenv("OPENROUTER_API_KEY")),
        ELEVENLABS_API_KEY=_clean(os.getenv("ELEVENLABS_API_KEY")),
        LLM_API_BASE=_clean(os.getenv("LLM_API_BASE")),
        LLM_API_KEY=_clean(os.getenv("LLM_API_KEY")),
        LLM_MODEL=_clean_with_default(os.getenv("LLM_MODEL"), "qwen-plus"),
        VLM_API_BASE=_clean(os.getenv("VLM_API_BASE")),
        VLM_API_KEY=_clean(os.getenv("VLM_API_KEY")),
        VLM_MODEL=_clean_with_default(os.getenv("VLM_MODEL"), "qwen-vl-plus"),
        STGCN_CHECKPOINT=_clean_with_default(
            os.getenv("STGCN_CHECKPOINT"), "model/bestbest/best_model_2.pth"
        ),
        ENABLE_STGCN=os.getenv("ENABLE_STGCN", "").strip().lower() in ("1", "true", "yes"),
        MODEL_SERVICE_API_KEYS=_clean(os.getenv("MODEL_SERVICE_API_KEYS")),
        MODEL_SERVICE_DB=_clean_with_default(os.getenv("MODEL_SERVICE_DB"), "model_usage.db"),
    )


@lru_cache
def get_settings() -> Settings:
    """返回进程级单例 ``Settings``。

    首次调用时加载 ``.env``（不覆盖已存在的环境变量），随后缓存结果。
    测试中可通过 ``get_settings.cache_clear()`` 重置缓存。
    """

    load_dotenv(override=False)
    return _from_environment()
