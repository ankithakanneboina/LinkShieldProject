#!/usr/bin/env python3
"""Step 3: independently re-evaluate the saved model on the held-out domain-grouped test split.

    python scripts/evaluate_model.py

Re-creates the identical split (same seed and function as training), scores the saved Joblib bundle and writes a
Markdown report next to the model. It fails loudly if the numbers differ from the ones recorded at training time.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from linkshield_ml import config  # noqa: E402
from linkshield_ml.features import FEATURE_NAMES  # noqa: E402
from linkshield_ml.training import TARGET_COL, evaluate, load_processed, split_by_group  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", type=Path, default=config.PROCESSED_PATH)
    ap.add_argument("--model-dir", type=Path, default=config.MODEL_DIR)
    args = ap.parse_args()

    model_path = args.model_dir / "linkshield_model.joblib"
    if not model_path.exists() or not args.input.exists():
        sys.exit("Need both the processed dataset and a trained model. Run prepare_dataset.py then train_models.py.")

    bundle = joblib.load(model_path)
    info = bundle["info"]
    df = load_processed(args.input)
    _, _, te = split_by_group(df, info["metrics"]["split"]["seed"])
    X, y = df[FEATURE_NAMES].iloc[te], df[TARGET_COL].to_numpy()[te]
    res = evaluate(y, bundle["model"].predict_proba(X)[:, 1], bundle["thresholds"]["decision"])
    recorded = info["metrics"]["test"]
    drift = {k: abs(res[k] - recorded[k]) for k in ("accuracy", "precision", "recall", "f1")}
    if max(drift.values()) > 1e-9:
        sys.exit(f"Re-evaluation differs from recorded metrics: {drift}")

    cm = res["confusion_matrix"]
    lines = [
        f"# LinkShield model evaluation\n",
        f"- Model: **{info['model_name']}** ({info['algorithm']}), version `{info['model_version']}`",
        f"- Dataset: {info['dataset']['name']} (SHA-256 `{info['dataset']['sha256']}`)",
        f"- Test split: {res['n']:,} URLs, domain-disjoint from training; positive class = phishing",
        f"- Decision threshold: {bundle['thresholds']['decision']}\n",
        "| Metric | Value |", "| --- | --- |",
        *[f"| {k} | {res[k]:.4f} |" for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "brier")],
        "\n| | Predicted legitimate | Predicted phishing |", "| --- | --- | --- |",
        f"| **Actual legitimate** | {cm['tn']:,} | {cm['fp']:,} |",
        f"| **Actual phishing** | {cm['fn']:,} | {cm['tp']:,} |",
        "\n## Model comparison (test @ 0.5, uncalibrated; selection used CV on train only)\n",
        "| Model | CV F1 | Test acc | Test precision | Test recall | Test F1 |", "| --- | --- | --- | --- | --- | --- |",
        *[f"| {c['model']} | {c['cv_f1_mean']:.4f} ± {c['cv_f1_std']:.4f} | {c['test']['accuracy']:.4f} | "
          f"{c['test']['precision']:.4f} | {c['test']['recall']:.4f} | {c['test']['f1']:.4f} |"
          for c in info["metrics"]["comparison"]],
    ]
    out = args.model_dir / "evaluation_report.md"
    out.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nRe-evaluation matches training metrics. Report written to {out}")


if __name__ == "__main__":
    main()
