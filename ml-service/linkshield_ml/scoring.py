"""Risk scoring and validation-derived thresholds.

risk_score    = round(100 * calibrated phishing probability)
decision      = F1-maximising probability threshold on the calibration split
medium / high = cut-offs chosen on the calibration split (see ``choose_thresholds``), not arbitrary constants
"""
from __future__ import annotations

import numpy as np

TARGET_PURITY = 0.99


def risk_category(probability: float, thresholds: dict) -> str:
    if probability >= thresholds["high"]:
        return "high"
    if probability >= thresholds["medium"]:
        return "medium"
    return "low"


def risk_score(probability: float) -> int:
    return int(round(100 * min(max(probability, 0.0), 1.0)))


def choose_thresholds(y_true_phishing: np.ndarray, proba: np.ndarray) -> dict:
    """Derive decision/medium/high thresholds from held-out calibration data.

    * decision: probability cut-off that maximises F1 for the phishing class.
    * medium:   largest cut-off m such that URLs scoring below m are >= 99 % legitimate
                (negative predictive value), so "low" really means low.
    * high:     smallest cut-off h such that URLs scoring >= h are >= 99 % phishing (precision).
    If a 99 % target cannot be met, the closest achievable cut-off is used and noted in ``method``.
    """
    y = np.asarray(y_true_phishing).astype(int)
    p = np.asarray(proba, dtype=float)
    grid = np.unique(np.round(np.concatenate([np.linspace(0.01, 0.99, 99), p]), 4))
    grid = grid[(grid > 0) & (grid < 1)]

    best_f1, decision = -1.0, 0.5
    for t in grid:
        pred = p >= t
        tp = int((pred & (y == 1)).sum()); fp = int((pred & (y == 0)).sum()); fn = int((~pred & (y == 1)).sum())
        f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else 0.0
        if f1 > best_f1:
            best_f1, decision = f1, float(t)

    notes: list[str] = []
    medium = None
    for t in sorted(grid):  # largest t with NPV >= target
        below = p < t
        if below.sum() == 0:
            continue
        npv = float((y[below] == 0).mean())
        if npv >= TARGET_PURITY:
            medium = float(t)
    if medium is None:
        medium = float(min(grid)); notes.append("medium: 99% NPV not reachable, used lowest cut-off")

    high = None
    for t in sorted(grid, reverse=True):  # smallest t with precision >= target
        above = p >= t
        if above.sum() == 0:
            continue
        precision = float((y[above] == 1).mean())
        if precision >= TARGET_PURITY:
            high = float(t)
    if high is None:
        high = float(max(grid)); notes.append("high: 99% precision not reachable, used highest cut-off")

    medium = min(medium, decision)
    high = max(high, decision)
    return {
        "decision": round(decision, 4),
        "medium": round(medium, 4),
        "high": round(high, 4),
        "target_purity": TARGET_PURITY,
        "method": ("decision = F1-maximising threshold on calibration split; medium = largest cut-off with >=99% "
                   "legitimate below it; high = smallest cut-off with >=99% phishing at or above it"
                   + ("; " + "; ".join(notes) if notes else "")),
    }
