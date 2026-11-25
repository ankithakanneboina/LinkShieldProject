"""Shared training/evaluation helpers (used by scripts and tests)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import (accuracy_score, brier_score_loss, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.tree import DecisionTreeClassifier

from .config import RANDOM_STATE
from .features import FEATURE_NAMES

TARGET_COL = "label_phishing"  # 1 = phishing (positive class), 0 = legitimate
GROUP_COL = "group"
TRAIN_FRAC, CALIB_FRAC, TEST_FRAC = 0.70, 0.15, 0.15


def load_processed(path) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = [c for c in [*FEATURE_NAMES, TARGET_COL, GROUP_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Processed dataset is missing columns {missing}; re-run prepare_dataset.py")
    return df


def split_by_group(df: pd.DataFrame, seed: int = RANDOM_STATE):
    """Domain-grouped train/calibration/test split: no registrable domain appears in two splits."""
    groups = df[GROUP_COL].to_numpy()
    outer = GroupShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=seed)
    trainval_idx, test_idx = next(outer.split(df, groups=groups))
    inner = GroupShuffleSplit(n_splits=1, test_size=CALIB_FRAC / (TRAIN_FRAC + CALIB_FRAC), random_state=seed)
    tr_rel, ca_rel = next(inner.split(df.iloc[trainval_idx], groups=groups[trainval_idx]))
    return trainval_idx[tr_rel], trainval_idx[ca_rel], test_idx


def make_models(seed: int = RANDOM_STATE, *, small: bool = False) -> dict:
    """The three models compared. ``small`` shrinks them for fast unit tests only."""
    if small:
        return {
            "decision_tree": DecisionTreeClassifier(max_depth=6, random_state=seed),
            "random_forest": RandomForestClassifier(n_estimators=20, max_depth=8, n_jobs=-1, random_state=seed),
            "gradient_boosting": GradientBoostingClassifier(n_estimators=20, max_depth=3, random_state=seed),
        }
    return {
        "decision_tree": DecisionTreeClassifier(max_depth=12, min_samples_leaf=5, class_weight="balanced",
                                                random_state=seed),
        "random_forest": RandomForestClassifier(n_estimators=200, min_samples_leaf=2, max_features="sqrt",
                                                class_weight="balanced_subsample", n_jobs=-1, random_state=seed),
        "gradient_boosting": GradientBoostingClassifier(n_estimators=150, max_depth=4, learning_rate=0.1,
                                                        subsample=0.8, random_state=seed),
    }


def evaluate(y_true, proba, threshold: float = 0.5) -> dict:
    y = np.asarray(y_true).astype(int)
    p = np.asarray(proba, dtype=float)
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    both = len(np.unique(y)) == 2
    return {
        "n": int(len(y)),
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y, pred)),
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall": float(recall_score(y, pred, zero_division=0)),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y, p)) if both else None,
        "brier": float(brier_score_loss(y, p)),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def risk_category_stats(y_true, proba, thresholds: dict) -> list[dict]:
    from .scoring import risk_category
    y = np.asarray(y_true).astype(int)
    cats = np.array([risk_category(p, thresholds) for p in proba])
    out = []
    for c in ("low", "medium", "high"):
        m = cats == c
        out.append({"category": c, "count": int(m.sum()),
                    "phishing_rate": round(float(y[m].mean()), 4) if m.any() else None})
    return out
