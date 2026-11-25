# LinkShield – AI-Powered Phishing URL Detection and Risk Analysis Platform

LinkShield classifies a URL as **phishing** or **legitimate** from the URL *string alone*, gives a calibrated risk score, and explains the result using only features that were actually measured. Full stack: React · Node/Express · PostgreSQL · Python (scikit-learn + FastAPI).

> **Read this first – project status (honest summary)**
>
> | Item | Status |
> |---|---|
> | UCI PhiUSIIL dataset | **Not included in this ZIP.** The build environment could not reach the UCI host. Download it yourself (see [Dataset](#dataset)); the pipeline locates it at `data/raw/PhiUSIIL_Phishing_URL_Dataset.csv`. |
> | Trained model / metrics | **None exist yet.** No model was trained and no accuracy/F1 figure is claimed anywhere. Run the three scripts below to produce a model and real metrics. Until then the ML service reports "no model loaded" and scans return `503`. |
> | Code actually executed during the build | PostgreSQL migration and every dashboard/analytics/admin/history SQL query (PG 16); Python feature extraction, scoring, explanation and training-pipeline code paths (pytest, on a tiny **synthetic test fixture used only by tests**); static checks of the React client (syntax, imports, exports); `node --check` on all server files. |
> | Written but **not run** here | Express server and its supertest suite, PDF generation, React build and Vitest suite, FastAPI endpoint tests (no package installs were possible). Expect to fix small issues on first run. |

## Architecture

```
React (Vite, Tailwind, Recharts) ──/api──▶ Express (JWT, RBAC, zod) ──▶ PostgreSQL
                                                │
                                                └──▶ FastAPI ML service (joblib model, same feature code as training)
```

The submitted URL is **never opened, crawled or downloaded**; only its text is analysed (`server/src/utils/url.js`, `ml-service/linkshield_ml/features.py`). Non-http(s) schemes (`javascript:`, `data:`, `file:` …) are rejected.

```
client/        React app (12 pages)        server/      Express API, migrations, tests
ml-service/    features, training, FastAPI docs/API.md  REST contract
data/          raw + processed dataset (not committed)
```

## Prerequisites
Node ≥ 20, PostgreSQL ≥ 14, Python ≥ 3.10 (scikit-learn ≥ 1.6).

## Dataset

Source: **PhiUSIIL Phishing URL Dataset**, UCI Machine Learning Repository – https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset (≈235,795 rows, 54 columns, CC BY 4.0).

Citation: Prasad, A., & Chandra, S. (2023). *PhiUSIIL: A diverse security profile empowered phishing URL detection framework based on similarity index and incremental learning.* Computers & Security. Dataset: UCI ML Repository, DOI 10.24432/C5K61P.

Setup:
1. Download the ZIP from the page above, extract `PhiUSIIL_Phishing_URL_Dataset.csv`.
2. Place it at `data/raw/PhiUSIIL_Phishing_URL_Dataset.csv` (or set `LINKSHIELD_RAW_DATASET`).
3. Keep the original file unmodified; the pipeline writes derived data to `data/processed/`.

**Label mapping.** UCI documents `label = 1` → legitimate, `label = 0` → phishing. `prepare_dataset.py` does not trust this blindly: it cross-checks against other columns of the file and aborts if they disagree. The processed column `label_phishing` is `1` for phishing (the positive class in all metrics).

## Run the ML pipeline
```bash
cd ml-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/prepare_dataset.py     # verify columns/labels, dedupe, extract 24 URL features
python scripts/train_models.py        # compare Decision Tree / Random Forest / Gradient Boosting, calibrate, save joblib
python scripts/evaluate_model.py      # re-evaluate on the held-out test split -> evaluation_report.md
```
Method: domain-grouped 70/15/15 train/calibration/test split (no registrable domain appears in two splits), grouped k-fold CV on the training split only, best model by mean CV F1, probability calibration on the calibration split, risk thresholds derived from that same split. Reported: accuracy, precision, recall, F1, confusion matrix – all written by the scripts to `ml-service/models/metrics.json`. Dataset URLs are mostly complete, so check the reported numbers for optimism: this dataset is known to be easy, and domain-grouping is there to avoid inflating them.

Start the service: `uvicorn linkshield_ml.app:app --port 8000` (from `ml-service/`).

## Run the backend
```bash
createdb linkshield && createdb linkshield_test
cd server && cp ../.env.example .env       # edit DATABASE_URL and JWT_ACCESS_SECRET
npm install
npm run migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password-1' npm run create-admin
npm run dev                                # http://localhost:4000
```

## Run the frontend
```bash
cd client && npm install && npm run dev    # http://localhost:5173 (proxies /api to :4000)
```

## Tests
```bash
cd ml-service && pip install -r requirements-dev.txt && pytest
cd server && npm test                      # needs TEST_DATABASE_URL (database name must contain "test"; it is wiped)
cd client && npm test
```

## Security notes
bcrypt password hashing; 15-min JWT access tokens + rotating refresh tokens (stored hashed, httpOnly SameSite=Strict cookie, reuse detection); role read from the database on every request; owner-only data access enforced in SQL (other users' records return 404); zod validation; parameterized queries only; helmet, explicit-origin CORS, rate limiting; generic error messages; no secrets in source (`.env.example` holds placeholders and the server refuses to start with them). Feedback is stored as unverified opinion and is never used for training.

## API
See [docs/API.md](docs/API.md).

## Limitations
URL-string analysis cannot see page content, so it can miss phishing on clean-looking domains and flag odd but legitimate URLs. Results are risk indicators, not verdicts.
