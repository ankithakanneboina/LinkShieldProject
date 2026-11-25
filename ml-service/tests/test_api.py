"""HTTP-level tests for the FastAPI service. Skipped automatically if fastapi/httpx are not installed."""
import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402

from linkshield_ml.app import create_app  # noqa: E402


@pytest.fixture()
def client(trained_model_dir):
    with TestClient(create_app(trained_model_dir / "linkshield_model.joblib")) as c:
        yield c


def test_health_and_model_info(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["model_loaded"] is True
    info = client.get("/model-info").json()
    assert info["model_version"] == h["model_version"] and "metrics" in info


def test_predict_ok(client):
    r = client.post("/predict", json={"url": "https://www.example.com/a"})
    assert r.status_code == 200
    body = r.json()
    for k in ("prediction", "phishing_probability", "risk_score", "risk_category", "risk_factors", "model", "features"):
        assert k in body


@pytest.mark.parametrize("payload", [{"url": ""}, {"url": "javascript:alert(1)"}, {"url": "a" * 3000}])
def test_predict_invalid_url_returns_400(client, payload):
    r = client.post("/predict", json=payload)
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_URL"


def test_predict_bad_body_returns_400(client):
    r = client.post("/predict", json={"nope": 1})
    assert r.status_code == 400 and r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_no_model_returns_503(tmp_path):
    with TestClient(create_app(tmp_path / "missing.joblib")) as c:
        assert c.get("/health").json()["model_loaded"] is False
        r = c.post("/predict", json={"url": "https://example.com"})
        assert r.status_code == 503 and r.json()["error"]["code"] == "MODEL_NOT_LOADED"
