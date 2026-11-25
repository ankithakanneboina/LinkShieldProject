"""Test fixtures.

IMPORTANT: ``synthetic_processed_csv`` builds a SYNTHETIC toy dataset purely to exercise the training/serving code
paths (split, fit, calibrate, save, load, predict) quickly. It is NOT the UCI PhiUSIIL dataset, it is written to a
pytest temp directory, and models trained on it are meaningless for real detection.
"""
import random
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

ML_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ML_ROOT))

from linkshield_ml.features import FEATURE_NAMES, extract_features, normalize_url, registrable_domain  # noqa: E402
from urllib.parse import urlsplit  # noqa: E402

WORDS = ["garden", "music", "travel", "school", "recipes", "sports", "photo", "books", "health", "movies"]


def _legit(rng):
    return f"https://www.{rng.choice(WORDS)}{rng.randint(1, 9999)}.{rng.choice(['com', 'org', 'net'])}/{rng.choice(WORDS)}"


def _phish(rng):
    kind = rng.random()
    if kind < 0.3:
        return f"http://{rng.randint(1, 255)}.{rng.randint(0, 255)}.{rng.randint(0, 255)}.{rng.randint(1, 255)}/login/verify"
    return (f"http://secure-login.{rng.choice(WORDS)}-{rng.randint(1, 9999)}.account-verify.example{rng.randint(1, 99999)}"
            f".{rng.choice(['tk', 'xyz', 'top'])}/update/confirm/{'a' * rng.randint(10, 60)}?id={rng.randint(1, 999999)}")


@pytest.fixture(scope="session")
def synthetic_processed_csv(tmp_path_factory) -> Path:
    rng = random.Random(7)
    rows = []
    for i in range(3000):
        phishing = i % 2
        url = normalize_url(_phish(rng) if phishing else _legit(rng))[0]
        host = (urlsplit(url).hostname or "").lower()
        rows.append({"url": url, "group": registrable_domain(host), "label_phishing": phishing,
                     **extract_features(url)})
    path = tmp_path_factory.mktemp("synthetic") / "synthetic_features.csv"
    pd.DataFrame(rows, columns=["url", "group", "label_phishing", *FEATURE_NAMES]).to_csv(path, index=False)
    return path


@pytest.fixture(scope="session")
def trained_model_dir(synthetic_processed_csv, tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("model")
    subprocess.run(
        [sys.executable, str(ML_ROOT / "scripts" / "train_models.py"), "--input", str(synthetic_processed_csv),
         "--prep-report", str(out / "none.json"), "--model-dir", str(out), "--small-models", "--cv-folds", "3"],
        check=True, capture_output=True, text=True)
    return out
