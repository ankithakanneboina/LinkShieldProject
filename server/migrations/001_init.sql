-- LinkShield initial schema (PostgreSQL 13+; uses built-in gen_random_uuid()).
-- Applied exactly once by server/scripts/migrate.js (tracked in schema_migrations).

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          varchar(60)  NOT NULL,
  email         varchar(254) NOT NULL,
  password_hash varchar(100) NOT NULL,
  role          varchar(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active     boolean      NOT NULL DEFAULT true,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
-- Case-insensitive uniqueness of e-mail addresses.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));
CREATE INDEX users_created_at_idx ON users (created_at DESC);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Refresh tokens (only the SHA-256 hash of the opaque token is stored)
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash char(64)    NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent varchar(255),
  ip_address inet
);
CREATE INDEX refresh_tokens_user_idx    ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- Scan history (one row per analysed URL, owned by a user)
-- ---------------------------------------------------------------------------
CREATE TABLE scan_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  submitted_url        varchar(2048) NOT NULL,
  normalized_url       varchar(2048) NOT NULL,
  hostname             varchar(255)  NOT NULL,
  scheme_assumed       boolean       NOT NULL DEFAULT false,
  prediction           varchar(10)   NOT NULL CHECK (prediction IN ('phishing', 'legitimate')),
  phishing_probability double precision NOT NULL CHECK (phishing_probability BETWEEN 0 AND 1),
  risk_score           smallint      NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_category        varchar(10)   NOT NULL CHECK (risk_category IN ('low', 'medium', 'high')),
  model_name           varchar(50)   NOT NULL,
  model_version        varchar(50)   NOT NULL,
  scanned_at           timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX scan_history_user_time_idx  ON scan_history (user_id, scanned_at DESC);
CREATE INDEX scan_history_user_pred_idx  ON scan_history (user_id, prediction);
CREATE INDEX scan_history_user_risk_idx  ON scan_history (user_id, risk_category);
CREATE INDEX scan_history_user_host_idx  ON scan_history (user_id, hostname);
CREATE INDEX scan_history_time_idx       ON scan_history (scanned_at DESC);

-- ---------------------------------------------------------------------------
-- URL features extracted for a scan (JSONB keeps the table stable when the
-- feature set evolves; extractor_version records which extractor produced it).
-- ---------------------------------------------------------------------------
CREATE TABLE url_features (
  scan_id           uuid PRIMARY KEY REFERENCES scan_history (id) ON DELETE CASCADE,
  features          jsonb       NOT NULL CHECK (jsonb_typeof(features) = 'object'),
  contributions     jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(contributions) = 'array'),
  extractor_version varchar(20) NOT NULL
);

-- ---------------------------------------------------------------------------
-- Human-readable risk factors that were actually triggered for a scan
-- ---------------------------------------------------------------------------
CREATE TABLE risk_factors (
  id              bigserial PRIMARY KEY,
  scan_id         uuid         NOT NULL REFERENCES scan_history (id) ON DELETE CASCADE,
  position        smallint     NOT NULL,
  code            varchar(50)  NOT NULL,
  title           varchar(160) NOT NULL,
  description     text         NOT NULL,
  severity        varchar(10)  NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  feature_name    varchar(60),
  feature_value   double precision,
  model_influence double precision,
  UNIQUE (scan_id, position)
);
CREATE INDEX risk_factors_code_idx ON risk_factors (code);

-- ---------------------------------------------------------------------------
-- User feedback. This is UNVERIFIED opinion: it is not ground truth and is never
-- used for automatic retraining.
-- ---------------------------------------------------------------------------
CREATE TABLE user_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id    uuid        NOT NULL REFERENCES scan_history (id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category   varchar(30) NOT NULL
             CHECK (category IN ('correct', 'false_positive', 'false_negative', 'unclear_explanation', 'other')),
  comments   varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scan_id, user_id)
);
CREATE INDEX user_feedback_created_idx  ON user_feedback (created_at DESC);
CREATE INDEX user_feedback_category_idx ON user_feedback (category);
CREATE INDEX user_feedback_user_idx     ON user_feedback (user_id);

CREATE TRIGGER user_feedback_set_updated_at BEFORE UPDATE ON user_feedback
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Registered ML model versions (synchronised from the ML service /model-info)
-- ---------------------------------------------------------------------------
CREATE TABLE model_information (
  id                serial PRIMARY KEY,
  model_name        varchar(50)  NOT NULL,
  model_version     varchar(50)  NOT NULL UNIQUE,
  algorithm         varchar(150) NOT NULL,
  trained_at        timestamptz,
  dataset_name      varchar(200),
  dataset_records   integer,
  feature_count     smallint,
  extractor_version varchar(20),
  metrics           jsonb        NOT NULL DEFAULT '{}'::jsonb,
  risk_thresholds   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  details           jsonb        NOT NULL DEFAULT '{}'::jsonb,
  is_active         boolean      NOT NULL DEFAULT false,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);
-- At most one active model version.
CREATE UNIQUE INDEX model_information_one_active_idx ON model_information (is_active) WHERE is_active;

CREATE TRIGGER model_information_set_updated_at BEFORE UPDATE ON model_information
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
