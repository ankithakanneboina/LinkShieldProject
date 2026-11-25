"""Filesystem locations. Everything is overridable so tests and deployments can relocate artefacts."""
from __future__ import annotations

import os
from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ML_ROOT.parent

DATASET_FILENAME = "PhiUSIIL_Phishing_URL_Dataset.csv"
RAW_DATASET_PATH = Path(os.getenv("LINKSHIELD_RAW_DATASET", REPO_ROOT / "data" / "raw" / DATASET_FILENAME))
PROCESSED_PATH = Path(os.getenv("LINKSHIELD_PROCESSED", REPO_ROOT / "data" / "processed" / "url_features.csv"))
PREP_REPORT_PATH = Path(os.getenv("LINKSHIELD_PREP_REPORT", REPO_ROOT / "data" / "processed" / "preparation_report.json"))
MODEL_DIR = Path(os.getenv("LINKSHIELD_MODEL_DIR", ML_ROOT / "models"))
MODEL_PATH = MODEL_DIR / "linkshield_model.joblib"
METRICS_PATH = MODEL_DIR / "metrics.json"

DATASET_URL = "https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset"
DATASET_ZIP_URL = "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip"
DATASET_NAME = "UCI PhiUSIIL Phishing URL Dataset"
RANDOM_STATE = 42
