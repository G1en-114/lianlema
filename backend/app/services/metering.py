"""模型服务用量计量（SQLite）。

按 API-key 记录每次模型服务调用（vision / coach / plan）与 token 消耗，
为「免费额度 + 订阅 + 按次加油包」的售卖模式提供数据面。
独立于业务库（alembic/SQLAlchemy），用标准库 sqlite3，零额外依赖。
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

KINDS = ("vision", "coach", "plan")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL,
    kind TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_key_kind ON usage_events (api_key, kind);
"""


class UsageMeter:
    """线程安全的用量计量器。"""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        with self._lock:
            self._conn.executescript(_SCHEMA)
            self._conn.commit()

    def record(self, api_key: str, kind: str, tokens: int = 0) -> None:
        if kind not in KINDS:
            raise ValueError(f"unknown usage kind: {kind}")
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with self._lock:
            self._conn.execute(
                "INSERT INTO usage_events (api_key, kind, tokens, created_at) VALUES (?, ?, ?, ?)",
                (api_key, kind, int(tokens), now),
            )
            self._conn.commit()

    def summary(self, api_key: str) -> dict:
        """按 api-key 汇总各维度调用量与 token 总量。"""
        rows = self._conn.execute(
            "SELECT kind, COUNT(*), COALESCE(SUM(tokens), 0) FROM usage_events "
            "WHERE api_key = ? GROUP BY kind",
            (api_key,),
        ).fetchall()
        result: dict = {"api_key": _mask(api_key), "total_calls": 0, "total_tokens": 0}
        for kind in KINDS:
            result[f"{kind}_calls"] = 0
        for kind, calls, tokens in rows:
            result[f"{kind}_calls"] = calls
            result["total_calls"] += calls
            result["total_tokens"] += tokens
        return result

    def close(self) -> None:
        self._conn.close()


def _mask(api_key: str) -> str:
    """对外只回显脱敏后的 key（首 3 位 + ***）。"""
    if len(api_key) <= 3:
        return "***"
    return f"{api_key[:3]}***"


@lru_cache
def get_meter() -> UsageMeter:
    """进程级单例计量器；测试可用 ``get_meter.cache_clear()`` 重置。"""
    return UsageMeter(get_settings().MODEL_SERVICE_DB)
