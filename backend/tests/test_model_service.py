"""模型服务接口测试（天猫黑客松定制款）。

覆盖：
- ``/api/status``、``/api/tiers`` 基础面。
- ``/api/vision/analyze``：无论 ST-GCN 是否可用（取决于环境有无 torch），
  都必须 200 且给出结构化 form；桩路径永不 5xx。
- ``/api/coach/chat``：未配置 LLM 密钥时模板兜底（source=template）。
- 角度规则：深蹲深度判定（确定性）。
- 计量：调用次数与 token 汇总正确。
- 鉴权：配置 MODEL_SERVICE_API_KEYS 后无 key 401、有 key 200。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.providers.vision.angle_rules import SQUAT_MAX_KNEE_ANGLE, assess_form, min_knee_angle
from app.services.metering import UsageMeter, get_meter

client = TestClient(app)


@pytest.fixture()
def isolated_env(tmp_path, monkeypatch):
    """计量库与配置缓存隔离：每个用例独立的 SQLite 与 Settings。"""
    monkeypatch.setenv("MODEL_SERVICE_DB", str(tmp_path / "usage.db"))
    monkeypatch.delenv("MODEL_SERVICE_API_KEYS", raising=False)
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("LLM_API_BASE", raising=False)
    # 测试中 ST-GCN 保持关闭：其加载依赖宿主 torch 环境，且个别环境会原生崩溃。
    monkeypatch.delenv("ENABLE_STGCN", raising=False)
    get_settings.cache_clear()
    get_meter.cache_clear()
    yield
    get_settings.cache_clear()
    get_meter.cache_clear()


def _frame(hip: tuple[float, float]) -> list[list[float]]:
    """构造一帧 COCO-17 关键点：只填髋/膝/踝（双侧同值），其余为零。"""
    knee = (0.5, 0.6)
    ankle = (0.5, 0.9)
    frame = [[0.0, 0.0] for _ in range(17)]
    for idx, point in (
        (11, hip), (12, hip), (13, knee), (14, knee), (15, ankle), (16, ankle),
    ):
        frame[idx] = [point[0], point[1]]
    return frame


# ---- 基础面 ----


def test_status_reports_capability_matrix(isolated_env) -> None:
    resp = client.get("/api/status")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"stgcn", "vlm", "llm", "auth"}
    assert body["auth"] == "disabled-dev"  # 测试未配置密钥
    assert body["stgcn"] is False  # 测试环境保持关闭（显式开关）


def test_tiers_catalog_shape(isolated_env) -> None:
    resp = client.get("/api/tiers")
    assert resp.status_code == 200
    tiers = resp.json()["tiers"]
    assert [t["id"] for t in tiers] == ["free", "pro", "booster"]
    assert all("price" in t and "features" in t for t in tiers)


# ---- 视觉分析 ----


def test_vision_analyze_never_5xx_without_models(isolated_env) -> None:
    """桩路径：ST-GCN 未开启时接口仍 200 且结构完整、明确标注降级原因。"""
    frames = [_frame((0.5, 0.45)) for _ in range(60)]
    resp = client.post("/api/vision/analyze", json={"exercise": "squat", "frames": frames})
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "stub"
    assert body["form"]["confidence"] == "low"
    assert "ENABLE_STGCN" in body["form"]["note"]  # 降级原因对用户透明
    assert body["vlm_assessment"] is None  # 未配置 VLM


def test_vision_analyze_empty_frames_returns_low_confidence(isolated_env) -> None:
    resp = client.post("/api/vision/analyze", json={"exercise": "squat", "frames": []})
    assert resp.status_code == 200
    assert resp.json()["form"]["confidence"] == "low"


# ---- 角度规则（确定性） ----


def test_min_knee_angle_straight_legs_is_180() -> None:
    frames = [_frame((0.5, 0.45))]
    assert min_knee_angle(frames) == pytest.approx(180.0)


def test_shallow_squat_flagged_not_standard() -> None:
    """直立（膝角 180°）蹲不下去 → 深度不足。"""
    frames = [_frame((0.5, 0.45)) for _ in range(10)]
    form = assess_form(frames, "squats", "squat", 0.9)
    assert form.is_standard is False
    assert any(p.area == "knee" for p in form.problem_areas)


def test_deep_squat_is_standard() -> None:
    """膝角约 89°（< 110° 阈值）→ 达标。"""
    frames = [_frame((0.2, 0.62)) for _ in range(10)]
    assert min_knee_angle(frames) < SQUAT_MAX_KNEE_ANGLE
    form = assess_form(frames, "squats", "squat", 0.9)
    assert form.is_standard is True
    assert form.confidence == "high"


def test_action_mismatch_flagged() -> None:
    frames = [_frame((0.5, 0.45)) for _ in range(10)]
    form = assess_form(frames, "pushups", "squat", 0.9)
    assert any(p.area == "action" for p in form.problem_areas)


# ---- 教练对话（模板兜底） ----


def test_coach_chat_falls_back_to_template_without_llm_key(isolated_env) -> None:
    resp = client.post(
        "/api/coach/chat",
        json={
            "messages": [{"role": "user", "content": "今天练什么？"}],
            "context": {"today_plan": "下肢力量 20 分钟", "streak_days": 3},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "template"
    assert "下肢力量 20 分钟" in body["reply"]
    assert "连续打卡 3 天" in body["reply"]
    assert isinstance(body["suggestions"], list) and body["suggestions"]


def test_plan_explain_uses_template_and_references_facts(isolated_env) -> None:
    resp = client.post(
        "/api/plan/explain",
        json={"plan_summary": "晨间微训练：颈肩放松 2 分钟"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "template"
    assert "颈肩放松" in body["reply"]


# ---- 计量 ----


def test_usage_meter_counts_and_tokens(tmp_path) -> None:
    meter = UsageMeter(tmp_path / "m.db")
    meter.record("k-123", "vision")
    meter.record("k-123", "vision")
    meter.record("k-123", "coach", tokens=87)
    summary = meter.summary("k-123")
    assert summary["vision_calls"] == 2
    assert summary["coach_calls"] == 1
    assert summary["total_calls"] == 3
    assert summary["total_tokens"] == 87
    assert summary["api_key"].startswith("k-1") and "***" in summary["api_key"]
    meter.close()


def test_api_usage_accumulates_across_calls(isolated_env) -> None:
    client.post("/api/coach/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    client.post("/api/vision/analyze", json={"frames": []})
    resp = client.get("/api/usage")
    assert resp.status_code == 200
    body = resp.json()
    assert body["coach_calls"] == 1
    assert body["vision_calls"] == 1


# ---- 鉴权 ----


def test_api_key_enforced_when_configured(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MODEL_SERVICE_DB", str(tmp_path / "u.db"))
    monkeypatch.setenv("MODEL_SERVICE_API_KEYS", "secret-a, secret-b")
    monkeypatch.delenv("ENABLE_STGCN", raising=False)
    get_settings.cache_clear()
    get_meter.cache_clear()
    try:
        no_key = client.get("/api/usage")
        assert no_key.status_code == 401

        bad_key = client.get("/api/usage", headers={"X-API-Key": "wrong"})
        assert bad_key.status_code == 401

        ok = client.get("/api/usage", headers={"X-API-Key": "secret-a"})
        assert ok.status_code == 200
        assert ok.json()["api_key"] == "sec***"
    finally:
        get_settings.cache_clear()
        get_meter.cache_clear()
