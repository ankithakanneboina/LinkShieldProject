"""End-to-end pipeline tests on a SYNTHETIC toy fixture (see conftest.py): they verify the code, not detection quality."""
import json
import subprocess
import sys

import pytest

from conftest import ML_ROOT
from linkshield_ml.features import FEATURE_NAMES, InvalidURLError
from linkshield_ml.predictor import ModelNotLoadedError, Predictor
from linkshield_ml.training import load_processed, split_by_group


def test_group_split_has_no_domain_overlap(synthetic_processed_csv):
    df = load_processed(synthetic_processed_csv)
    tr, ca, te = split_by_group(df)
    g = df["group"].to_numpy()
    assert not set(g[tr]) & set(g[te]) and not set(g[tr]) & set(g[ca]) and not set(g[ca]) & set(g[te])
    assert len(tr) + len(ca) + len(te) == len(df)


def test_training_saves_bundle_and_metrics(trained_model_dir):
    assert (trained_model_dir / "linkshield_model.joblib").exists()
    info = json.loads((trained_model_dir / "metrics.json").read_text())
    assert {c["model"] for c in info["metrics"]["comparison"]} == {"decision_tree", "random_forest", "gradient_boosting"}
    for key in ("accuracy", "precision", "recall", "f1", "confusion_matrix"):
        assert key in info["metrics"]["test"]
    t = info["risk_thresholds"]
    assert 0 < t["medium"] <= t["decision"] <= t["high"] < 1.0
    assert info["feature_names"] == FEATURE_NAMES


def test_selection_uses_cv_not_test(trained_model_dir):
    info = json.loads((trained_model_dir / "metrics.json").read_text())
    best = max(info["metrics"]["comparison"], key=lambda c: c["cv_f1_mean"])["model"]
    assert info["metrics"]["selected_model"] == best


def test_model_loading_and_prediction_output(trained_model_dir):
    p = Predictor(trained_model_dir / "linkshield_model.joblib")
    assert p.load() and p.loaded
    r = p.predict("http://secure-login.account-verify.example123.tk/update/confirm/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?id=5")
    assert r["prediction"] in ("phishing", "legitimate")
    assert 0 <= r["phishing_probability"] <= 1 and 0 <= r["risk_score"] <= 100
    assert r["risk_score"] == round(100 * r["phishing_probability"])
    assert r["risk_category"] in ("low", "medium", "high")
    assert set(r["features"]) == set(FEATURE_NAMES)
    assert r["model"]["version"] == p.version
    for rf in r["risk_factors"]:  # explanations must be backed by real feature values
        assert rf["feature"] in r["features"] and rf["value"] == r["features"][rf["feature"]]


def test_phishing_like_scores_higher_than_legit_like(trained_model_dir):
    p = Predictor(trained_model_dir / "linkshield_model.joblib"); p.load()
    bad = p.predict("http://secure-login.garden-12.account-verify.example999.tk/update/confirm/" + "a" * 40 + "?id=1")
    good = p.predict("https://www.garden77.com/music")
    assert bad["phishing_probability"] > good["phishing_probability"]


def test_unsupported_risk_factors_are_never_shown(trained_model_dir):
    info = json.loads((trained_model_dir / "metrics.json").read_text())
    p = Predictor(trained_model_dir / "linkshield_model.joblib"); p.load()
    r = p.predict("http://192.168.0.1:8080/login/verify?a=1&b=2&c=3&d=4&e=5")
    supported = {c for c, s in info["rule_stats"].items() if s["supported"]}
    assert {rf["code"] for rf in r["risk_factors"]} <= supported


@pytest.mark.parametrize("bad", ["", "javascript:alert(1)", "http://", "ftp://x.com"])
def test_invalid_url_handling(trained_model_dir, bad):
    p = Predictor(trained_model_dir / "linkshield_model.joblib"); p.load()
    with pytest.raises(InvalidURLError):
        p.predict(bad)


def test_missing_model_is_reported(tmp_path):
    p = Predictor(tmp_path / "nope.joblib")
    assert p.load() is False
    with pytest.raises(ModelNotLoadedError):
        p.predict("https://example.com")


def test_evaluate_script_reproduces_recorded_metrics(trained_model_dir, synthetic_processed_csv):
    res = subprocess.run([sys.executable, str(ML_ROOT / "scripts" / "evaluate_model.py"), "--input",
                          str(synthetic_processed_csv), "--model-dir", str(trained_model_dir)],
                         capture_output=True, text=True)
    assert res.returncode == 0, res.stderr + res.stdout
    assert (trained_model_dir / "evaluation_report.md").exists()


def test_prepare_script_explains_missing_dataset(tmp_path):
    res = subprocess.run([sys.executable, str(ML_ROOT / "scripts" / "prepare_dataset.py"), "--input",
                          str(tmp_path / "missing.csv")], capture_output=True, text=True)
    assert res.returncode != 0 and "archive.ics.uci.edu" in (res.stderr + res.stdout)
