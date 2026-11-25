# 🛡️ LinkShield

**AI-Powered Phishing URL Detection and Risk Analysis Platform**

LinkShield is a full-stack web application that analyses a URL **as text only** and tells the user whether it looks like **phishing or legitimate**, with a calibrated risk score and an explanation built only from features that were really measured.

The platform provides **user authentication, scan history, analytics, PDF reports, an admin dashboard, and a machine-learning prediction service** trained on the UCI PhiUSIIL dataset.

> 🔒 Submitted links are **never opened, visited, crawled or downloaded**. Only the URL string is analysed.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Objectives](#-objectives)
- [Key Features](#-key-features)
- [Screenshots](#-screenshots)
- [Demo Video](#-demo-video)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Machine Learning Pipeline](#-machine-learning-pipeline)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Setup](#-installation--setup)
- [Environment Variables](#-environment-variables)
- [Running the Application](#-running-the-application)
- [Application Workflow](#-application-workflow)
- [API Overview](#-api-overview)
- [Database](#-database)
- [Authentication & Security](#-authentication--security)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Limitations](#-limitations)
- [Future Enhancements](#-future-enhancements)
- [Dataset Attribution](#-dataset-attribution)
- [Contributing](#-contributing)
- [License](#-license)
- [Author](#-author)

---

# 📖 Overview

**LinkShield** is a web-based platform for checking suspicious links before clicking them.

Users can:

- Register and log in securely
- Paste a URL and scan it
- See a verdict: **Phishing** or **Legitimate**
- See a **0-100 risk score** and a low / medium / high category
- See the real reasons behind the result
- Browse, search, filter and delete their scan history
- View a personal dashboard and analytics charts
- Download a PDF report for any scan
- Send feedback on a result
- Manage their profile and password

Administrators can additionally view users, all scans, feedback, platform statistics, recent activity and the active model with its evaluation metrics.

---

# ❗ Problem Statement

Phishing links are a common way to steal passwords and money. Many link checkers are black boxes: they give a verdict without saying why, and some actually visit the link, which can itself be unsafe.

Typical problems:

- Users cannot tell why a link was flagged
- Probabilities are often uncalibrated model scores
- Tools that open the link expose the checker to unsafe content
- Models trained on one dataset may learn quirks of that dataset instead of real phishing signals

LinkShield addresses these by explaining each verdict, calibrating probabilities, analysing only the URL text, and checking the model's behaviour on well-known sites.

---

# 🎯 Objectives

1. Classify a URL as phishing or legitimate using machine learning.
2. Give a calibrated risk score and risk category.
3. Explain results using only features present in the URL and supported by training data.
4. Never access the submitted URL (no SSRF risk).
5. Store scan history in PostgreSQL per user.
6. Provide dashboards and analytics from real stored data.
7. Provide secure authentication with role-based access.
8. Provide PDF reports and an admin dashboard.
9. Report real evaluation metrics and honest limitations.

---

# ✨ Key Features

## 👤 User Authentication

- Registration and login
- 15-minute JWT access tokens
- Rotating refresh tokens in an httpOnly cookie
- Role-based access (user / admin)
- Profile management and password change

## 🔎 URL Scanner

- Paste a URL (the `https://` part is optional)
- Verdict, risk score, risk category and estimated phishing probability
- **Risk analysis**: only features present in the URL and measurably more common in phishing during training
- **What moved the score**: each feature's impact in percentage points
- Clear disclaimer on every result

## 📜 Scan History

- Search, filter by result and risk level, sort, paginate
- Open a scan's full details
- Delete a scan (only your own)

## 📊 Dashboard & Analytics

- Totals, phishing vs legitimate, risk distribution
- Daily and weekly trends, top domains, risk-score distribution
- All numbers computed from stored scans (no hardcoded values)

## 📄 PDF Reports

- Real PDF generated from the stored scan
- Non-Latin look-alike characters are shown as `[U+XXXX]`, which exposes homograph tricks

## 💬 Feedback

- Mark a result as correct, false positive, false negative or other
- Stored as **unverified opinion** and never used to retrain the model

## 🛠️ Admin Dashboard

- Users, all scans, feedback and recent activity
- Platform totals
- Active model details and its real evaluation metrics

---

# 📸 Screenshots

> Add your screenshots to `docs/screenshots/` using these file names.


### 🔐 Login and Registration

![Login](Screenshots/Screenshot-9.png)
![Register](Screenshots/Screenshot-10.png)

### 🏠 check a link

![Landing Page](Screenshots/Screenshot-8.png)

---
### 🔎 Scanner: How WORKS

![Legitimate result](Screenshots/Screenshot-7.png)

---
### 🔎 Scanner: Legitimate Result

![Legitimate result](Screenshots/Screenshot-6.png)

---

### 📜 Scan History

![History](Screenshots/Screenshot-2.png)
![History](Screenshots/Screenshot-3.png)

---

### 📊 Dashboard

![Dashboard](Screenshots/Screenshot-1.png)

---

### 📈 Analytics

![Analytics](Screenshots/Screenshot-4.png)

---

### 🛠️ Admin Dashboard

![Admin](Screenshots/Screenshot-5.png)

---

# 🎥 Demo Video

## Project Demonstration

**▶️ Demo Video:**  
[Click here to watch the project demo](YOUR_DEMO_VIDEO_LINK)

> Replace `YOUR_DEMO_VIDEO_LINK` with your YouTube or Google Drive link.

### Demo Covers

1. User registration and login
2. Scanning a legitimate URL
3. Scanning a phishing-looking URL
4. Reading the risk analysis and "what moved the score"
5. Scan history: search, filter, delete
6. Dashboard and analytics
7. Downloading a PDF report
8. Sending feedback
9. Admin dashboard and model information
10. Logout

---

# 🛠️ Technology Stack

## Frontend

- React 18
- JavaScript
- Vite
- Tailwind CSS
- React Router
- Axios
- Recharts
- Lucide Icons

## Backend

- Node.js
- Express.js
- REST APIs
- JWT authentication
- bcrypt
- zod (validation)
- pdfkit (PDF reports)

## Database

- PostgreSQL

## Machine Learning

- Python
- Pandas, NumPy
- Scikit-learn
- Joblib
- FastAPI (prediction service)

## Testing

- Node test runner + supertest
- Vitest + Testing Library
- pytest

## Development Tools

- Visual Studio Code
- Git and GitHub
- Postman

---

# 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │         User         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    React Frontend    │
                    │  UI + Routing +      │
                    │  Charts + Axios      │
                    └──────────┬───────────┘
                               │
                         HTTP / REST
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Express Backend    │
                    │  JWT + RBAC          │
                    │  Validation          │
                    │  Business logic      │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
       ┌─────────────────┐          ┌──────────────────────┐
       │   PostgreSQL    │          │   FastAPI ML Service │
       │ Users           │          │ 24 URL features      │
       │ Scans           │          │ Joblib model         │
       │ Features        │          │ Calibration          │
       │ Risk factors    │          │ Explanations         │
       │ Feedback        │          └──────────────────────┘
       │ Model info      │
       └─────────────────┘
```

---

# 🤖 Machine Learning Pipeline

| | |
|---|---|
| **Dataset** | [PhiUSIIL Phishing URL Dataset](https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset) (UCI): 134,850 legitimate and 100,945 phishing URLs |
| **Features** | 24 URL-string features: lengths, dots, hyphens, digits, entropy, IP host, HTTPS, suspicious keywords, punycode, unusual port, and more |
| **Same code in training and serving** | One shared feature extractor |
| **Models compared** | Decision Tree, Random Forest, Gradient Boosting |
| **Splitting** | Domain-grouped 70 / 15 / 15 train / calibration / test, so no domain appears in two splits |
| **Model selection** | Best mean cross-validated F1 on the training split only (phishing = positive class) |
| **Calibration** | Isotonic or sigmoid, fitted on the calibration split |
| **Risk thresholds** | Derived from the calibration split |
| **Explanations** | Shown only if the feature is present and training statistics support it |

## 📊 Results (held-out, domain-grouped test split)


The confusion matrix and the comparison of all three models are in `ml-service/models/evaluation_report.md` after you run the pipeline.

## 🔬 A Real Finding

An early model scored `https://github.com` as **100% phishing**. The "what moved the score" panel showed why: *dots = 1 (typical 2)* added +99.8 points.

In this dataset most legitimate URLs start with `www.` while bare domains are mostly phishing, so the model had learned a **collection artefact**, not a real phishing signal.

**Fix (feature extractor v1.1):** a leading `www.` is ignored in training and serving, and the model was retrained. `github.com` now scores low risk, and a unit test guards the behaviour.

## Label Mapping

UCI documents `label = 1` as legitimate and `label = 0` as phishing. The preparation script re-checks this against other columns of the dataset and stops if they disagree. The processed column `label_phishing` is `1` for phishing.

---

# 📁 Project Structure

```text
linkshield/
│
├── client/                  React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── test/
│   └── package.json
│
├── server/                  Express backend
│   ├── migrations/          SQL schema
│   ├── scripts/             migrate, create-admin
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   └── validators/
│   ├── tests/
│   └── package.json
│
├── ml-service/              Python ML + FastAPI
│   ├── linkshield_ml/       features, scoring, explanations, API
│   ├── scripts/             prepare, train, evaluate
│   ├── tests/
│   └── requirements.txt
│
├── data/
│   ├── raw/                 put the UCI CSV here (not committed)
│   └── processed/
│
├── docs/
│   ├── API.md
│   └── screenshots/
│
├── .env.example
├── .gitignore
└── README.md
```

---

# ⚙️ Prerequisites

Install:

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer
- Python 3.10 or newer
- Git

Check versions:

```powershell
node --version
npm --version
psql --version
python --version
```

---

# 🚀 Installation & Setup

## 1️⃣ Clone the Repository

```powershell
git clone YOUR_GITHUB_REPOSITORY_URL
cd linkshield
```

## 2️⃣ Download the Dataset

The dataset is **not included** in this repository.

1. Open https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset
2. Click **Download** and extract the ZIP
3. Place the file here, keeping the exact name:

```text
data/raw/PhiUSIIL_Phishing_URL_Dataset.csv
```

---

# 🐍 ML Service Setup

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If activation is successful you should see `(.venv)`.

## Train the Model

Run in order and wait for each to finish:

```powershell
python scripts/prepare_dataset.py
python scripts/train_models.py
python scripts/evaluate_model.py
```

This writes the model and metrics to `ml-service/models/`.

---

# 🐘 PostgreSQL Setup

Create the databases:

```powershell
createdb linkshield
createdb linkshield_test
```

`linkshield_test` is only needed for `npm test`.

---

# 🔐 Environment Variables

Create `server/.env` from the example:

```powershell
cd server
copy ..\.env.example .env
```

Example:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://linkshield_user:CHANGE_ME@localhost:5432/linkshield
TEST_DATABASE_URL=postgres://linkshield_user:CHANGE_ME@localhost:5432/linkshield_test
JWT_ACCESS_SECRET=replace-with-a-long-random-string-0123456789
ML_SERVICE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:5173
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Separate database for tests (wiped on each run; its name must contain "test") |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens, at least 32 random characters |
| `ML_SERVICE_URL` | Address of the FastAPI service |
| `CORS_ORIGINS` | Allowed frontend origin(s) |
| `PORT` | Backend port |

Generate a secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

⚠️ Never upload your real `.env` file. The server refuses to start with the placeholder secret.

---

# ▶️ Running the Application

Run the three services in **separate terminals**.

### Terminal 1: ML Service

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
uvicorn linkshield_ml.app:app --port 8000
```

### Terminal 2: Backend

First time only:

```powershell
cd server
npm install
npm run migrate
$env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="a-long-password-1"; npm run create-admin
```

Then:

```powershell
npm run dev
```

Backend: `http://localhost:4000`

### Terminal 3: Frontend

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

---

# 🔁 Application Workflow

```text
User
 │
 ▼
Register / Login
 │
 ▼
Scanner: paste URL
 │
 ▼
Express validates the URL text
 │
 ▼
ML service: extract 24 features → predict → calibrate → explain
 │
 ▼
Result stored in PostgreSQL
 │
 ├───────────────┬───────────────┐
 ▼               ▼               ▼
History      Dashboard /      PDF report
             Analytics
 │
 ▼
Feedback (stored, never used for training)
```

---

# 🔌 API Overview

Full reference: [docs/API.md](docs/API.md)

### Authentication

```text
POST  /api/auth/register
POST  /api/auth/login
POST  /api/auth/refresh
POST  /api/auth/logout
GET   /api/auth/profile
PATCH /api/auth/profile
POST  /api/auth/change-password
```

### Scanning

```text
POST   /api/scan
GET    /api/scans
GET    /api/scans/:id
DELETE /api/scans/:id
```

### Dashboard, Feedback, Reports

```text
GET  /api/dashboard
GET  /api/analytics?range=30
POST /api/feedback
GET  /api/reports/:id/pdf
```

### Admin (admin role only)

```text
GET /api/admin/users
GET /api/admin/scans
GET /api/admin/analytics
GET /api/admin/feedback
GET /api/admin/model
GET /api/admin/activity
```

### Health

```text
GET /api/health
```

### ML service (internal)

```text
GET  /health
GET  /model-info
POST /predict
```

---

# 🗄️ Database

The project uses **PostgreSQL** with SQL migrations (`server/migrations/`).

| Table | Stores |
|---|---|
| `users` | Name, email, bcrypt password hash, role, active flag |
| `refresh_tokens` | SHA-256 hashes of refresh tokens, expiry, revocation |
| `scan_history` | URL, verdict, probability, risk score and category, model version |
| `url_features` | The extracted feature values for each scan |
| `risk_factors` | The explanation entries shown for each scan |
| `user_feedback` | One feedback entry per user per scan |
| `model_information` | Model name, version, metrics and active flag |

Deleting a scan also deletes its features, risk factors and feedback.

---

# 🔐 Authentication & Security

- bcrypt password hashing
- 15-minute JWT access tokens
- Refresh tokens stored only as SHA-256 hashes, in an httpOnly `SameSite=Strict` cookie, with rotation and reuse detection
- Role read from the database on every request, so disabling or demoting a user takes effect immediately
- Owner-only access enforced in SQL; another user's record returns 404
- zod input validation and parameterized SQL only
- helmet security headers, explicit-origin CORS, rate limiting
- Generic error messages (no internals leaked)
- Non-http(s) schemes (`javascript:`, `data:`, `file:`) are rejected
- **The submitted URL is never fetched**
- No secrets in the repository

---

# 🧪 Testing

```powershell
cd ml-service; pytest
cd server; npm test
cd client; npm test
```

`npm test` in `server` needs `TEST_DATABASE_URL`. It **wipes that database**, so use a separate one.

Covered: URL validation, feature extraction, the training pipeline, registration and login, token refresh and reuse detection, owner-only access, admin-only access, scan creation and storage, history filters, feedback, PDF generation, error handling and configuration safety.

---

# 🐛 Troubleshooting

## Scan fails with "model not available"

The ML service is not running or no model has been trained. Run the training scripts, then start `uvicorn`.

## "Port already in use"

An old process is still running. Stop it (Ctrl+C in its terminal), or free the port:

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Python scripts cannot find files

Run the Python commands from the `ml-service` folder.

## Registration shows "Something went wrong"

The backend or PostgreSQL is not running. Check the backend terminal and run `Get-Service *postgres*`.

## Server refuses to start

Check `JWT_ACCESS_SECRET` (at least 32 characters, not the placeholder) and `DATABASE_URL` in `server/.env`.

---

# ⚠️ Limitations

- URL text alone cannot see page content. It can miss phishing on clean-looking domains and flag unusual but legitimate URLs.
- The dataset has collection artefacts (see [A Real Finding](#-a-real-finding)). Others may remain.
- The model leans on length features, so very short deceptive URLs can score low.
- Results are risk indicators, not verdicts. Do not use them as the only basis for a security decision.

---

# 🔮 Future Enhancements

- 🌐 Browser extension that checks links before you click
- 🧪 Evaluation on a second, independent phishing dataset
- 🔎 Look-alike (typosquatting) domain detection
- 📧 Email notifications for risky scans
- ☁️ Cloud deployment with Docker
- 📱 Mobile-friendly app
- 🛡️ Admin moderation tools
- 📊 Model monitoring and drift detection

---

# 📚 Dataset Attribution

Prasad, A., & Chandra, S. (2023). *PhiUSIIL: A diverse security profile empowered phishing URL detection framework based on similarity index and incremental learning.* Computers & Security, 103545.

Dataset: UCI Machine Learning Repository (CC BY 4.0). The dataset is not redistributed in this repository.

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/new-feature
```

3. Make your changes and commit.

```bash
git commit -m "Add new feature"
```

4. Push the branch.

```bash
git push origin feature/new-feature
```

5. Create a Pull Request.

---

# 📄 License

This project is created for educational and portfolio purposes.

You may modify and extend the project according to your requirements.

---

# 👩‍💻 Author

## Ankitha Kanneboina

**B.Tech: Computer Science and Engineering**

Interested in:

- Artificial Intelligence
- Machine Learning
- Full-Stack Development
- Data Analytics
- Software Development

### Connect With Me

- GitHub: [Ankitha Kanneboina](https://github.com/ankithakanneboina)
- LinkedIn: [Ankitha Kanneboina](https://www.linkedin.com/in/ankitha-kanneboina-45a545324/)

---

## 🚀 LinkShield

**Paste. Scan. Understand. Stay safe.**

A phishing URL analyser that explains its verdicts and never opens your link.
