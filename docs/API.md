# LinkShield API Reference

This document is the contract between the React client, the Express backend and the Python ML service.
All backend routes are prefixed with `/api`. Request and response bodies are JSON unless noted.
Backend JSON uses **camelCase**. The ML service uses **snake_case** (the backend maps between them).

- [Conventions](#conventions)
- [Backend: Authentication](#authentication)
- [Backend: Scanning](#scanning)
- [Backend: Dashboard and analytics](#dashboard-and-analytics)
- [Backend: Feedback](#feedback)
- [Backend: PDF reports](#pdf-reports)
- [Backend: Admin](#admin)
- [ML service API](#ml-service-api)
- [Shared reference: features, risk factors, risk categories](#shared-reference)

## Conventions

### Authentication

Protected routes need `Authorization: Bearer <accessToken>`.
Access tokens are short-lived JWTs (default 15 minutes). The refresh token is an opaque random value stored
**hashed** (SHA-256) in PostgreSQL and delivered as an `httpOnly`, `SameSite=Strict` cookie named `ls_refresh`,
scoped to `/api/auth`. `POST /api/auth/refresh` rotates it. Presenting an already-revoked refresh token revokes every
refresh token of that user (reuse detection).

### Error format

Every error uses the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable summary",
    "details": [{ "field": "email", "message": "Enter a valid email address" }]
  }
}
```

`details` is only present for validation errors.

| HTTP | `code`                    | Meaning                                                        |
| ---- | ------------------------- | -------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`        | Body, query or path parameter failed validation                |
| 400  | `INVALID_URL`             | URL is not an acceptable http(s) URL                           |
| 401  | `UNAUTHORIZED`            | Missing or invalid access token                                |
| 401  | `TOKEN_EXPIRED`           | Access token expired (client should call `/auth/refresh`)      |
| 401  | `INVALID_CREDENTIALS`     | Wrong email or password (deliberately generic)                 |
| 403  | `FORBIDDEN`               | Authenticated but not allowed (e.g. non-admin, disabled user)  |
| 404  | `NOT_FOUND`               | Resource does not exist **or belongs to another user**         |
| 409  | `CONFLICT`                | e.g. email already registered                                  |
| 429  | `RATE_LIMITED`            | Too many requests                                              |
| 500  | `INTERNAL_ERROR`          | Unexpected error (details are never leaked)                    |
| 503  | `ML_SERVICE_UNAVAILABLE`  | ML service unreachable, timed out, or has no trained model     |

### Pagination

List endpoints accept `page` (default 1) and `limit` (default 10, max 50) and return:

```json
{ "data": [], "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
```

### Common object shapes

**User**

```json
{ "id": "uuid", "name": "Ada Lovelace", "email": "ada@example.com", "role": "user", "createdAt": "ISO-8601", "lastLoginAt": "ISO-8601|null" }
```

**ScanSummary**

```json
{
  "id": "uuid",
  "submittedUrl": "paypal.com.secure-login.example.tk/verify",
  "normalizedUrl": "https://paypal.com.secure-login.example.tk/verify",
  "hostname": "paypal.com.secure-login.example.tk",
  "schemeAssumed": true,
  "prediction": "phishing",
  "phishingProbability": 0.9731,
  "riskScore": 97,
  "riskCategory": "high",
  "modelName": "random_forest",
  "modelVersion": "2026.11.10-ab12cd34",
  "scannedAt": "ISO-8601"
}
```

`prediction` is `"phishing" | "legitimate"`. `riskCategory` is `"low" | "medium" | "high"`.
`phishingProbability` is a number in `[0,1]`; `riskScore` is an integer in `[0,100]`.

**ScanDetail** = ScanSummary plus:

```json
{
  "extractorVersion": "1.0",
  "features": { "url_length": 48, "domain_length": 34, "...": 0 },
  "riskFactors": [
    {
      "code": "ip_address",
      "title": "Host is an IP address",
      "description": "…",
      "severity": "high",
      "feature": "has_ip_address",
      "value": 1,
      "modelInfluence": 0.21
    }
  ],
  "contributions": [
    { "feature": "url_length", "value": 142, "baseline": 31, "influence": 0.12 }
  ],
  "feedback": null
}
```

`feedback` is `null` or `{ "id", "category", "comments", "createdAt", "updatedAt" }`.
`modelInfluence` may be `null`. `contributions` is sorted by `abs(influence)` descending.

---

## Authentication

Rate limit: 20 requests / 15 minutes / IP on all `/api/auth/*` mutation routes.

### `POST /api/auth/register`

Body: `{ "name": string(2–60), "email": string, "password": string }`
Password policy: 10–72 characters (bcrypt limit), at least one letter and one digit.
Registration always creates role `user`.

- `201` → `{ "user": User, "accessToken": string, "expiresIn": 900 }` and sets the `ls_refresh` cookie
- `400 VALIDATION_ERROR`, `409 CONFLICT` (email exists; case-insensitive)

### `POST /api/auth/login`

Body: `{ "email": string, "password": string }`

- `200` → same shape as register, sets cookie, updates `lastLoginAt`
- `401 INVALID_CREDENTIALS`, `403 FORBIDDEN` (account disabled), `400 VALIDATION_ERROR`

### `POST /api/auth/refresh`

No body needed (cookie). API clients may send `{ "refreshToken": string }` instead.

- `200` → `{ "user": User, "accessToken": string, "expiresIn": 900 }` and rotates the cookie
- `401 UNAUTHORIZED` (missing, expired, revoked or unknown token; cookie is cleared)

### `POST /api/auth/logout`

Revokes the presented refresh token (cookie or body) and clears the cookie. Works with an expired access token.

- `204` always (idempotent)

### `GET /api/auth/profile` 🔒

- `200` → `{ "user": User & { "scanCount": number } }`

### `PATCH /api/auth/profile` 🔒

Body: `{ "name": string(2–60) }`

- `200` → `{ "user": User & { "scanCount": number } }`

### `POST /api/auth/change-password` 🔒

Body: `{ "currentPassword": string, "newPassword": string }` (new password follows the policy above)

- `204`. All refresh tokens of the user are revoked and the cookie is cleared; the client must log in again.
- `401 INVALID_CREDENTIALS` if `currentPassword` is wrong, `400 VALIDATION_ERROR`

---

## Scanning

### `POST /api/scan` 🔒

Rate limit: 30 requests / minute / user.

Body: `{ "url": string }`

The backend validates and normalises the string, calls the ML service, stores the result and returns it.
**The submitted URL is never fetched, visited or crawled by LinkShield.**

Validation: trimmed, 1–2048 characters, no whitespace or control characters inside, scheme (if present) must be
`http` or `https`, host must parse. A missing scheme is assumed to be `https://` and `schemeAssumed` is `true`.

- `201` → `{ "scan": ScanDetail }`
- `400 INVALID_URL | VALIDATION_ERROR`, `503 ML_SERVICE_UNAVAILABLE`

### `GET /api/scans` 🔒

Query: `page`, `limit`, `search` (case-insensitive substring of the normalized URL, max 200 chars),
`prediction` (`phishing|legitimate`), `risk` (`low|medium|high`), `sort` (`newest` default | `oldest`).

- `200` → `{ "data": ScanSummary[], "pagination": {…} }` (only the caller's scans)

### `GET /api/scans/:id` 🔒

- `200` → `{ "scan": ScanDetail }`
- `404 NOT_FOUND` for unknown ids, malformed ids **and other users' scans**

### `DELETE /api/scans/:id` 🔒

Deletes the scan and (via `ON DELETE CASCADE`) its features, risk factors and feedback.

- `204`, `404 NOT_FOUND`

---

## Dashboard and analytics

### `GET /api/dashboard` 🔒

```json
{
  "totals": { "totalScans": 12, "phishingCount": 5, "legitimateCount": 7, "highRiskCount": 4 },
  "recentScans": [ "ScanSummary (up to 5, newest first)" ],
  "dailyActivity": [ { "date": "2026-11-10", "total": 3, "phishing": 1, "legitimate": 2 } ],
  "weeklyTrend": [ { "weekStart": "2026-11-09", "total": 7, "phishing": 3, "legitimate": 4 } ],
  "riskDistribution": [ { "category": "low", "count": 6 }, { "category": "medium", "count": 2 }, { "category": "high", "count": 4 } ]
}
```

`dailyActivity` covers the last 14 days and `weeklyTrend` the last 8 ISO weeks (Monday start), both **zero-filled**.
`riskDistribution` always contains all three categories. A user with no scans receives zeros and an empty `recentScans`.
Days and weeks are computed in UTC.

### `GET /api/analytics?range=30` 🔒

`range` is one of `7`, `30`, `90` (days; default 30).

```json
{
  "range": 30,
  "totals": { "totalScans": 0, "phishingCount": 0, "legitimateCount": 0, "highRiskCount": 0, "averageRiskScore": 0 },
  "dailySeries": [ { "date": "YYYY-MM-DD", "total": 0, "phishing": 0, "legitimate": 0 } ],
  "weeklyTrend": [ { "weekStart": "YYYY-MM-DD", "total": 0, "phishing": 0, "legitimate": 0 } ],
  "riskDistribution": [ { "category": "low", "count": 0 } ],
  "predictionSplit": [ { "prediction": "phishing", "count": 0 }, { "prediction": "legitimate", "count": 0 } ],
  "riskScoreBuckets": [ { "bucket": "0-9", "count": 0 } ],
  "topDomains": [ { "hostname": "example.com", "count": 3, "phishingCount": 1 } ],
  "topRiskFactors": [ { "code": "no_https", "title": "Connection is not HTTPS", "count": 4 } ]
}
```

`riskScoreBuckets` has 10 buckets (`0-9` … `90-100`). `topDomains` and `topRiskFactors` are limited to 5 entries.
All series are scoped to the caller and the requested range.

---

## Feedback

Feedback is **unverified user opinion**. It is never used as a ground-truth label or for automatic retraining.

### `POST /api/feedback` 🔒

Body: `{ "scanId": uuid, "category": "correct|false_positive|false_negative|unclear_explanation|other", "comments"?: string(≤1000) }`

One feedback entry per user per scan; submitting again updates it.

- `201` (created) or `200` (updated) → `{ "feedback": { "id", "scanId", "category", "comments", "createdAt", "updatedAt" } }`
- `404 NOT_FOUND` if the scan is not the caller's, `400 VALIDATION_ERROR`

Category meanings: `correct` result was accurate · `false_positive` flagged a site that is legitimate ·
`false_negative` marked a malicious site as legitimate · `unclear_explanation` · `other`.

---

## PDF reports

### `GET /api/reports/:id/pdf` 🔒

Returns `application/pdf` generated server-side from the stored scan, with
`Content-Disposition: attachment; filename="linkshield-report-<first 8 chars of id>.pdf"`.
Contains: LinkShield title, submitted URL, scan date/time, prediction, risk score, risk category, probability,
suspicious characteristics, model name/version and the disclaimer. Owner only.

- `200` (binary), `404 NOT_FOUND`

---

## Admin

All routes require role `admin` (`403 FORBIDDEN` otherwise, `401` when unauthenticated). Authorization is enforced
in the backend middleware, not only in the UI.

### `GET /api/admin/users` 🔒👑

Query: `page`, `limit`, `search` (name or email substring).

`200` → `{ "data": [ { "id","name","email","role","isActive","createdAt","lastLoginAt","scanCount" } ], "pagination": {…} }`

### `GET /api/admin/scans` 🔒👑

Query: `page`, `limit`, `search`, `prediction`, `risk`, `sort`.

`200` → `{ "data": [ ScanSummary & { "user": { "id","name","email" } } ], "pagination": {…} }`

### `GET /api/admin/analytics?range=30` 🔒👑

```json
{
  "range": 30,
  "totals": {
    "totalUsers": 0, "totalScans": 0, "phishingCount": 0, "legitimateCount": 0, "highRiskCount": 0,
    "totalFeedback": 0, "newUsersLast7Days": 0, "scansLast24h": 0
  },
  "dailySeries": [ { "date": "YYYY-MM-DD", "total": 0, "phishing": 0, "legitimate": 0 } ],
  "userGrowth": [ { "date": "YYYY-MM-DD", "newUsers": 0 } ],
  "riskDistribution": [ { "category": "low", "count": 0 } ],
  "feedbackByCategory": [ { "category": "correct", "count": 0 } ]
}
```

### `GET /api/admin/feedback` 🔒👑

Query: `page`, `limit`, `category`.

`200` → `{ "data": [ { "id","category","comments","createdAt","updatedAt","user": {"id","name","email"}, "scan": {"id","normalizedUrl","prediction","riskScore","riskCategory"} } ], "pagination": {…} }`

### `GET /api/admin/model` 🔒👑

Live model metadata from the ML service, synchronised into the `model_information` table.

```json
{
  "service": { "status": "ok", "checkedAt": "ISO-8601" },
  "active": {
    "modelName": "random_forest", "modelVersion": "…", "algorithm": "RandomForestClassifier + sigmoid calibration",
    "trainedAt": "ISO-8601", "datasetName": "UCI PhiUSIIL Phishing URL Dataset", "datasetRecords": 235795,
    "featureCount": 24, "extractorVersion": "1.0",
    "metrics": { "…": "see ML /model-info → metrics" },
    "riskThresholds": { "decision": 0.5, "medium": 0.2, "high": 0.9, "method": "…" },
    "details": { "…": "full ML /model-info payload" }
  },
  "history": [ { "modelVersion": "…", "modelName": "…", "trainedAt": "…", "isActive": true } ]
}
```

`service.status` is `ok`, `model_not_loaded` or `unavailable`. `active` is `null` when no model has ever been registered
and the ML service cannot supply one.

### `GET /api/admin/activity?limit=20` 🔒👑

`limit` max 50. `200` → `{ "data": [ { "type": "scan|registration|feedback", "at": "ISO-8601", "actor": { "name","email" }, "summary": "string", "refId": "uuid" } ] }`
Newest first, built from real `scan_history`, `users` and `user_feedback` rows.

### `GET /api/health`

Public. `200` → `{ "status": "ok", "database": "ok", "mlService": "ok|model_not_loaded|unavailable" }`
(`503` with `"database": "unavailable"` when PostgreSQL cannot be reached).

---

## ML service API

Internal service (default `http://localhost:8000`), called only by the backend. Never exposed to browsers.
Errors use `{ "error": { "code": string, "message": string } }`.

### `GET /health`

`200` → `{ "status": "ok", "model_loaded": true, "model_version": "…" }` (`model_loaded` false when no model file exists).

### `GET /model-info`

`503 MODEL_NOT_LOADED` when no model is available. Otherwise:

```json
{
  "model_name": "random_forest",
  "model_version": "2026.11.10-ab12cd34",
  "algorithm": "RandomForestClassifier + sigmoid calibration",
  "trained_at": "ISO-8601",
  "extractor_version": "1.0",
  "feature_names": ["url_length", "…"],
  "feature_count": 24,
  "dataset": {
    "name": "UCI PhiUSIIL Phishing URL Dataset", "source": "https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset",
    "sha256": "…", "records_raw": 235795, "records_used": 0, "phishing_records": 0, "legitimate_records": 0,
    "label_mapping": { "column": "label", "legitimate": 1, "phishing": 0, "positive_class": "phishing" },
    "label_check": { "consistent": true, "signals": {} }
  },
  "calibration": { "method": "sigmoid|isotonic", "calibration_records": 0 },
  "risk_thresholds": { "decision": 0.5, "medium": 0.0, "high": 0.0, "method": "documented in README" },
  "metrics": {
    "selected_model": "random_forest",
    "test": {
      "accuracy": 0, "precision": 0, "recall": 0, "f1": 0, "roc_auc": 0, "brier": 0, "n": 0,
      "confusion_matrix": { "tn": 0, "fp": 0, "fn": 0, "tp": 0 }
    },
    "comparison": [
      { "model": "decision_tree", "cv_f1_mean": 0, "cv_f1_std": 0,
        "test": { "accuracy": 0, "precision": 0, "recall": 0, "f1": 0, "confusion_matrix": { "tn": 0, "fp": 0, "fn": 0, "tp": 0 } } }
    ],
    "risk_category_stats": [ { "category": "low", "count": 0, "phishing_rate": 0 } ],
    "split": { "strategy": "domain-grouped", "train": 0, "calibration": 0, "test": 0 }
  },
  "feature_importance": [ { "feature": "url_length", "importance": 0.0 } ],
  "environment": { "python": "3.12.0", "scikit_learn": "1.6.1" }
}
```

The positive class is **phishing**. All numbers are produced by `scripts/train_models.py`; nothing is hand-written.

### `POST /predict`

Body: `{ "url": string(1–2048) }`

`200`:

```json
{
  "url": "https://paypal.com.secure-login.example.tk/verify",
  "scheme_assumed": false,
  "prediction": "phishing",
  "phishing_probability": 0.9731,
  "risk_score": 97,
  "risk_category": "high",
  "decision_threshold": 0.5,
  "features": { "url_length": 48, "...": 0 },
  "risk_factors": [
    { "code": "ip_address", "title": "…", "description": "…", "severity": "high",
      "feature": "has_ip_address", "value": 1, "model_influence": 0.21 }
  ],
  "contributions": [ { "feature": "url_length", "value": 142, "baseline": 31, "influence": 0.12 } ],
  "model": { "name": "random_forest", "version": "…", "extractor_version": "1.0" }
}
```

- `400 INVALID_URL` — empty, too long, unparsable, or no host
- `503 MODEL_NOT_LOADED` — train a model first (see README)

The service performs **no network I/O with the submitted URL**: it only parses the string.

---

## Shared reference

### Scoring method

`phishing_probability` is the **calibrated** probability of the phishing class (calibration fitted on a held-out,
domain-disjoint split). `risk_score = round(100 × phishing_probability)`.
`prediction = phishing` when `phishing_probability ≥ decision_threshold` (the F1-maximising threshold on the calibration split).
Risk categories use two thresholds learned from the same split:

- `medium` threshold: highest probability cut-off such that URLs scoring **below** it are ≥ 99 % legitimate on the calibration split (negative predictive value ≥ 0.99)
- `high` threshold: lowest probability cut-off such that URLs scoring **at or above** it are ≥ 99 % phishing (precision ≥ 0.99)

`low` < medium threshold ≤ `medium` < high threshold ≤ `high`. Thresholds are clamped so that
`medium ≤ decision ≤ high`. The thresholds and empirical per-category phishing rates on the test split are
reported in `/model-info`. If the 99 % target cannot be reached on the calibration data, the training script falls
back to the closest achievable threshold and records that in `risk_thresholds.method`.

### Feature names (ordered, 24)

| # | Key | Meaning |
| - | --- | ------- |
| 1 | `url_length` | Characters in the normalized URL |
| 2 | `domain_length` | Characters in the hostname |
| 3 | `path_length` | Characters in the path |
| 4 | `query_length` | Characters in the query string |
| 5 | `num_dots` | Dots in the whole URL |
| 6 | `num_hyphens` | Hyphens in the whole URL |
| 7 | `num_subdomains` | Subdomain labels (leading `www` ignored) |
| 8 | `num_digits` | Digits in the URL |
| 9 | `digit_ratio` | Digits ÷ URL length |
| 10 | `num_special_chars` | Characters other than letters, digits and `. - / : _` |
| 11 | `is_https` | 1 if scheme is https |
| 12 | `has_ip_address` | 1 if host is an IPv4/IPv6/decimal/hex address |
| 13 | `has_at_symbol` | 1 if the URL contains `@` |
| 14 | `is_shortener` | 1 if host is a known URL shortener |
| 15 | `suspicious_keyword_count` | Distinct suspicious keywords found (login, verify, secure, …) |
| 16 | `has_punycode` | 1 if any host label starts with `xn--` |
| 17 | `num_encoded_chars` | Percent-encoded sequences (`%xx`) |
| 18 | `has_unusual_port` | 1 if an explicit port other than 80/443 is present |
| 19 | `domain_entropy` | Shannon entropy (bits/char) of the hostname |
| 20 | `has_double_slash_in_path` | 1 if `//` appears after the host |
| 21 | `has_deceptive_https_token` | 1 if `http`/`https` appears again after the scheme (e.g. `https-bank.example`) |
| 22 | `num_query_params` | Query parameters |
| 23 | `longest_label_length` | Longest hostname label |
| 24 | `path_depth` | Non-empty path segments |

### Risk factor codes

`ip_address`, `at_symbol`, `url_shortener`, `punycode`, `suspicious_keywords`, `many_subdomains`, `long_url`,
`long_domain`, `long_path`, `long_query`, `many_hyphens`, `many_digits`, `many_special_chars`, `encoded_characters`,
`deceptive_https_token`, `unusual_port`, `high_domain_entropy`, `double_slash_path`, `no_https`, `many_query_params`,
`long_label`, `deep_path`.

A risk factor is only emitted when (a) its trigger condition holds for the actual extracted feature values **and**
(b) the characteristic was measurably more common among phishing URLs than legitimate URLs in the training data.
`severity` is derived from that measured likelihood ratio, not hard-coded.

### Disclaimer text (used in UI and PDF)

> LinkShield provides an automated risk estimate based only on the characteristics of the URL text. It does not open,
> visit or inspect the website. Machine-learning predictions can be wrong: a "legitimate" result does not guarantee that a
> website is safe, and a "phishing" result does not prove that it is malicious. Always use your own judgement and verify
> sensitive links through official channels.
