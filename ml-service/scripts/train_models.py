#!/usr/bin/env python3
"""Step 2: compare models, select, calibrate, derive risk thresholds, save.

    python scripts/train_models.py

Protocol (no test-set peeking):
  1. Domain-grouped split -> train 70% / calibration 15% / test 15% (no registrable domain crosses splits).
  2. Decision Tree, Random Forest and Gradient Boosting are cross-validated on TRAIN ONLY with GroupKFold.
  3. The model with the best mean CV F1 (phishing = positive class) is selected. The test split is not used for selection.
  4. The selected model is probability-calibrated on the CALIBRATION split; the decision/medium/high thresholds
     are chosen on that same split.
  5. All three models and the final calibrated model are evaluated once on the untouched TEST split.
  6. The bundle is saved with Joblib; metrics.json holds every reported number.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import sklearn
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import f1_score
from sklearn.model_selection import GroupKFold

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from linkshield_ml import config  # noqa: E402
from linkshield_ml.explain import compute_rule_stats  # noqa: E402
from linkshield_ml.features import EXTRACTOR_VERSION, FEATURE_NAMES  # noqa: E402
from linkshield_ml.scoring import choose_thresholds  # noqa: E402
from linkshield_ml.training import (GROUP_COL, TARGET_COL, evaluate, load_processed, make_models,  # noqa: E402
                                    risk_category_stats, split_by_group)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", type=Path, default=config.PROCESSED_PATH)
    ap.add_argument("--prep-report", type=Path, default=config.PREP_REPORT_PATH)
    ap.add_argument("--model-dir", type=Path, default=config.MODEL_DIR)
    ap.add_argument("--cv-folds", type=int, default=3)
    ap.add_argument("--seed", type=int, default=config.RANDOM_STATE)
    ap.add_argument("--small-models", action="store_true", help="tiny models for tests/smoke runs only")
    args = ap.parse_args()

    if not args.input.exists():
        sys.exit(f"Processed dataset not found: {args.input}\nRun: python scripts/prepare_dataset.py")
    prep = json.loads(args.prep_report.read_text()) if args.prep_report.exists() else {}

    df = load_processed(args.input)
    tr, ca, te = split_by_group(df, args.seed)
    X, y, groups = df[FEATURE_NAMES], df[TARGET_COL].to_numpy(), df[GROUP_COL].to_numpy()
    X_tr, y_tr, g_tr = X.iloc[tr], y[tr], groups[tr]
    X_ca, y_ca = X.iloc[ca], y[ca]
    X_te, y_te = X.iloc[te], y[te]
    assert not (set(groups[tr]) & set(groups[te])) and not (set(groups[tr]) & set(groups[ca])) \
        and not (set(groups[ca]) & set(groups[te])), "domain leakage between splits"
    print(f"Split (domain-grouped): train={len(tr):,} calibration={len(ca):,} test={len(te):,}")

    models = make_models(args.seed, small=args.small_models)
    comparison = []
    for name, est in models.items():
        print(f"\n[{name}] {args.cv_folds}-fold grouped CV on train ...")
        f1s = []
        for fold, (a, b) in enumerate(GroupKFold(n_splits=args.cv_folds).split(X_tr, y_tr, groups=g_tr), 1):
            m = clone(est).fit(X_tr.iloc[a], y_tr[a])
            f1s.append(float(f1_score(y_tr[b], m.predict(X_tr.iloc[b]), zero_division=0)))
            print(f"  fold {fold}: F1={f1s[-1]:.4f}")
        est.fit(X_tr, y_tr)
        test = evaluate(y_te, est.predict_proba(X_te)[:, 1], 0.5)
        comparison.append({"model": name, "cv_f1_mean": float(np.mean(f1s)), "cv_f1_std": float(np.std(f1s)),
                           "cv_f1_folds": f1s, "test": test})
        print(f"  test@0.5: acc={test['accuracy']:.4f} prec={test['precision']:.4f} "
              f"rec={test['recall']:.4f} f1={test['f1']:.4f}")

    selected = max(comparison, key=lambda r: r["cv_f1_mean"])["model"]  # CV on train only; test is not consulted
    base = models[selected]
    print(f"\nSelected by mean CV F1 (train only): {selected}")

    method = "isotonic" if len(ca) >= 10000 else "sigmoid"
    calibrated = CalibratedClassifierCV(FrozenEstimator(base), method=method).fit(X_ca, y_ca)
    thresholds = choose_thresholds(y_ca, calibrated.predict_proba(X_ca)[:, 1])
    p_te = calibrated.predict_proba(X_te)[:, 1]
    final = evaluate(y_te, p_te, thresholds["decision"])
    print(f"Calibrated ({method}) test@{thresholds['decision']}: {final}")

    importances = getattr(base, "feature_importances_", None)
    feature_importance = sorted(
        [{"feature": f, "importance": float(v)} for f, v in zip(FEATURE_NAMES, importances)],
        key=lambda r: -r["importance"]) if importances is not None else []

    rule_stats = compute_rule_stats(X_tr, y_tr)
    baselines = {f: float(X_tr[f].median()) for f in FEATURE_NAMES}

    now = datetime.now(timezone.utc)
    digest = hashlib.sha256(json.dumps([prep.get("input_sha256"), selected, args.seed, EXTRACTOR_VERSION,
                                        str(base.get_params())], sort_keys=True).encode()).hexdigest()[:8]
    version = f"{now:%Y.%m.%d}-{digest}"
    algorithm = f"{type(base).__name__} + {method} calibration"

    info = {
        "model_name": selected,
        "model_version": version,
        "algorithm": algorithm,
        "trained_at": now.isoformat(),
        "extractor_version": EXTRACTOR_VERSION,
        "feature_names": FEATURE_NAMES,
        "feature_count": len(FEATURE_NAMES),
        "dataset": {
            "name": config.DATASET_NAME, "source": config.DATASET_URL,
            "sha256": prep.get("input_sha256"), "records_raw": prep.get("records_raw"),
            "records_used": int(len(df)), "phishing_records": int(y.sum()),
            "legitimate_records": int(len(y) - y.sum()),
            "label_mapping": prep.get("label_mapping"), "label_check": prep.get("label_check"),
        },
        "calibration": {"method": method, "calibration_records": int(len(ca))},
        "risk_thresholds": thresholds,
        "metrics": {
            "selected_model": selected,
            "selection_rule": "highest mean grouped-CV F1 (phishing = positive class) on the train split only",
            "test": final,
            "comparison": comparison,
            "risk_category_stats": risk_category_stats(y_te, p_te, thresholds),
            "split": {"strategy": "domain-grouped (registrable domain)", "train": int(len(tr)),
                      "calibration": int(len(ca)), "test": int(len(te)), "seed": args.seed,
                      "cv_folds": args.cv_folds},
        },
        "feature_importance": feature_importance,
        "rule_stats": rule_stats,
        "environment": {"python": platform.python_version(), "scikit_learn": sklearn.__version__},
    }

    args.model_dir.mkdir(parents=True, exist_ok=True)
    bundle = {"model": calibrated, "feature_names": FEATURE_NAMES, "extractor_version": EXTRACTOR_VERSION,
              "baselines": baselines, "rule_stats": rule_stats, "thresholds": thresholds, "info": info}
    joblib.dump(bundle, args.model_dir / "linkshield_model.joblib", compress=3)
    (args.model_dir / "metrics.json").write_text(json.dumps(info, indent=2))
    print(f"\nSaved {args.model_dir / 'linkshield_model.joblib'} (version {version})")


if __name__ == "__main__":
    main()
