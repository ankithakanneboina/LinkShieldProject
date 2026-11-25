"""Loads the trained Joblib bundle and turns a URL string into a scored, explained prediction."""
from __future__ import annotations

import threading
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from .config import MODEL_PATH
from .explain import build_risk_factors
from .features import FEATURE_NAMES, features_from_raw
from .scoring import risk_category, risk_score


class ModelNotLoadedError(RuntimeError):
    """No trained model is available (run the training pipeline)."""


class Predictor:
    def __init__(self, model_path: Path | str = MODEL_PATH):
        self.model_path = Path(model_path)
        self._bundle: dict | None = None
        self._lock = threading.Lock()

    # -- loading ---------------------------------------------------------------------------------
    def load(self) -> bool:
        """Load the bundle if the file exists. Returns True when a model is available."""
        with self._lock:
            if not self.model_path.exists():
                self._bundle = None
                return False
            bundle = joblib.load(self.model_path)
            if bundle.get("feature_names") != FEATURE_NAMES:
                raise RuntimeError("Model was trained with a different feature set; retrain with the current extractor.")
            self._bundle = bundle
            return True

    @property
    def loaded(self) -> bool:
        return self._bundle is not None

    @property
    def version(self) -> str | None:
        return self._bundle["info"]["model_version"] if self._bundle else None

    def info(self) -> dict:
        if not self._bundle:
            raise ModelNotLoadedError("No trained model is loaded.")
        return self._bundle["info"]

    # -- prediction ------------------------------------------------------------------------------
    def predict(self, raw_url: str) -> dict:
        if not self._bundle:
            raise ModelNotLoadedError("No trained model is loaded.")
        b = self._bundle
        normalized, assumed, feats = features_from_raw(raw_url)  # raises InvalidURLError

        # Row 0 is the URL; rows 1..n replace one feature with its training median (occlusion).
        base_row = np.array([feats[f] for f in FEATURE_NAMES], dtype=float)
        matrix = np.tile(base_row, (len(FEATURE_NAMES) + 1, 1))
        for i, f in enumerate(FEATURE_NAMES, start=1):
            matrix[i, i - 1] = b["baselines"][f]
        probs = b["model"].predict_proba(pd.DataFrame(matrix, columns=FEATURE_NAMES))[:, 1]
        p = float(probs[0])

        influence = {f: float(p - probs[i]) for i, f in enumerate(FEATURE_NAMES, start=1)}
        contributions = sorted(
            ({"feature": f, "value": float(feats[f]), "baseline": b["baselines"][f], "influence": round(v, 4)}
             for f, v in influence.items() if abs(v) >= 1e-4),
            key=lambda c: -abs(c["influence"]))[:10]

        thr = b["thresholds"]
        info = b["info"]
        shown = {k: (int(v) if float(v).is_integer() else round(float(v), 4)) for k, v in feats.items()}
        risk_factors = build_risk_factors(feats, b["rule_stats"], influence)
        for rf in risk_factors:  # report the same (rounded) value that is shown in `features`
            rf["value"] = shown[rf["feature"]]
        return {
            "url": normalized,
            "scheme_assumed": assumed,
            "prediction": "phishing" if p >= thr["decision"] else "legitimate",
            "phishing_probability": round(p, 4),
            "risk_score": risk_score(p),
            "risk_category": risk_category(p, thr),
            "decision_threshold": thr["decision"],
            "features": shown,
            "risk_factors": risk_factors,
            "contributions": contributions,
            "model": {"name": info["model_name"], "version": info["model_version"],
                      "extractor_version": info["extractor_version"]},
        }
