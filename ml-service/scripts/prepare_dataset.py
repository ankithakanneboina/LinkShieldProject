#!/usr/bin/env python3
"""Step 1: prepare the UCI PhiUSIIL dataset.

Reads the ORIGINAL dataset CSV, verifies columns and the label meaning, cleans it, extracts the URL-string
features with the SAME code the live service uses, and writes data/processed/url_features.csv.

    python scripts/prepare_dataset.py                       # uses data/raw/PhiUSIIL_Phishing_URL_Dataset.csv
    python scripts/prepare_dataset.py --input path/to.csv --output out.csv

Label handling (do not assume!): the UCI page documents label 1 = legitimate and 0 = phishing. This script
re-checks that claim against columns of the dataset itself and stops if they disagree.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from linkshield_ml import config  # noqa: E402
from linkshield_ml.features import (EXTRACTOR_VERSION, FEATURE_NAMES, InvalidURLError, extract_features,  # noqa: E402
                                    normalize_url, registrable_domain)
from urllib.parse import urlsplit  # noqa: E402

EXPECTED_LABEL = {"column": "label", "legitimate": 1, "phishing": 0}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_label_mapping(df: pd.DataFrame, label_col: str) -> dict:
    """Cross-check the documented mapping using the dataset's own independent columns."""
    values = sorted(pd.unique(df[label_col].dropna()).tolist())
    if values != [0, 1]:
        raise SystemExit(f"Unexpected values in '{label_col}': {values} (expected [0, 1])")
    signals: dict[str, dict] = {}
    votes_legit_is_1 = 0
    checks = 0
    # Legitimate sites are expected to have a higher URL similarity index and a higher HTTPS rate.
    for col in ("URLSimilarityIndex", "IsHTTPS", "HasSocialNet", "HasCopyrightInfo"):
        if col in df.columns:
            m1 = float(df.loc[df[label_col] == 1, col].mean())
            m0 = float(df.loc[df[label_col] == 0, col].mean())
            signals[col] = {"mean_label_1": round(m1, 4), "mean_label_0": round(m0, 4)}
            checks += 1
            votes_legit_is_1 += int(m1 > m0)
    consistent = checks > 0 and votes_legit_is_1 == checks
    return {"consistent": bool(consistent), "signals": signals, "checks": checks, "agreeing": votes_legit_is_1}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", type=Path, default=config.RAW_DATASET_PATH)
    ap.add_argument("--output", type=Path, default=config.PROCESSED_PATH)
    ap.add_argument("--report", type=Path, default=config.PREP_REPORT_PATH)
    ap.add_argument("--max-rows", type=int, default=None, help="debug only: read just the first N rows")
    args = ap.parse_args()

    if not args.input.exists():
        sys.exit(
            f"Dataset not found at {args.input}\n\n"
            f"Download '{config.DATASET_NAME}' from\n  {config.DATASET_URL}\n"
            f"(or {config.DATASET_ZIP_URL}), unzip it and place\n  {config.DATASET_FILENAME}"
            f"\nat {args.input}\nThen re-run this script. See README.md > 'Dataset'."
        )

    print(f"Reading {args.input} ...")
    df = pd.read_csv(args.input, nrows=args.max_rows)
    records_raw = len(df)
    for col in ("URL", EXPECTED_LABEL["column"]):
        if col not in df.columns:
            sys.exit(f"Required column '{col}' not found. Columns present: {list(df.columns)}")
    print(f"  {records_raw:,} rows x {df.shape[1]} columns")

    label_check = verify_label_mapping(df, EXPECTED_LABEL["column"])
    print(f"  label check: {label_check}")
    if not label_check["consistent"]:
        sys.exit("Label mapping could not be confirmed from the dataset's own columns; refusing to continue. "
                 "Inspect the data and the UCI documentation before training.")

    # --- cleaning (no leakage between duplicates) -------------------------------------------------
    df = df.dropna(subset=["URL", "label"]).copy()
    df["URL"] = df["URL"].astype(str).str.strip()
    df = df[df["URL"] != ""]
    conflict = df.groupby("URL")["label"].nunique()
    conflicting = set(conflict[conflict > 1].index)
    df = df[~df["URL"].isin(conflicting)]
    before = len(df)
    df = df.drop_duplicates(subset="URL", keep="first")
    duplicates_removed = before - len(df)

    # --- feature extraction (same function as the live service) -------------------------------------
    rows, invalid = [], 0
    for i, (url, label) in enumerate(zip(df["URL"], df["label"]), 1):
        try:
            normalized, _ = normalize_url(url)
            feats = extract_features(normalized)
        except InvalidURLError:
            invalid += 1
            continue
        host = (urlsplit(normalized).hostname or "").lower()
        rows.append({"url": normalized, "group": registrable_domain(host),
                     "label_phishing": int(label == EXPECTED_LABEL["phishing"]), **feats})
        if i % 50000 == 0:
            print(f"  extracted {i:,}/{len(df):,}")

    out = pd.DataFrame(rows, columns=["url", "group", "label_phishing", *FEATURE_NAMES])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False)

    report = {
        "source": config.DATASET_URL,
        "dataset_name": config.DATASET_NAME,
        "input_file": str(args.input.name),
        "input_sha256": sha256_file(args.input),
        "records_raw": records_raw,
        "records_conflicting_labels_removed": len(conflicting),
        "duplicate_urls_removed": duplicates_removed,
        "invalid_urls_skipped": invalid,
        "records_used": len(out),
        "phishing_records": int(out["label_phishing"].sum()),
        "legitimate_records": int((1 - out["label_phishing"]).sum()),
        "distinct_domain_groups": int(out["group"].nunique()),
        "label_mapping": {**EXPECTED_LABEL, "positive_class": "phishing",
                          "note": "processed column label_phishing = 1 for phishing (dataset label 0), 0 for legitimate (dataset label 1)"},
        "label_check": label_check,
        "extractor_version": EXTRACTOR_VERSION,
        "feature_names": FEATURE_NAMES,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "feature_names"}, indent=2))
    print(f"\nWrote {args.output}  and  {args.report}")


if __name__ == "__main__":
    main()
