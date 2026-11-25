import request from 'supertest';
import { migrate } from '../scripts/migrate.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db.js';
import { mlUnavailable } from '../src/utils/errors.js';

export const TEST_PASSWORD = 'correct-horse-1';

/** Requires TEST_DATABASE_URL (a PostgreSQL database whose name contains "test"; it is wiped by these tests). */
export function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
    CORS_ORIGINS: 'http://localhost:5173',
    ...overrides,
  });
}

export async function resetDatabase(pool) {
  const { rows } = await pool.query('SELECT current_database() AS db');
  if (!/test/i.test(rows[0].db)) throw new Error(`Refusing to wipe "${rows[0].db}": the database name must contain "test"`);
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool, { log: () => {} });
}

/**
 * Stand-in for the Python ML service so API tests do not need a trained model.
 * It returns the documented response shape. The probabilities are fixture values, NOT real model output.
 */
export function createFakeMl() {
  const state = { available: true, modelLoaded: true, calls: [] };
  return {
    state,
    async predict(url) {
      state.calls.push(url);
      if (!state.available) throw mlUnavailable();
      const suspicious = /phish|login|verify|\d+\.\d+\.\d+\.\d+/i.test(url);
      const p = suspicious ? 0.97 : 0.03;
      return {
        url,
        scheme_assumed: false,
        prediction: suspicious ? 'phishing' : 'legitimate',
        phishing_probability: p,
        risk_score: Math.round(p * 100),
        risk_category: suspicious ? 'high' : 'low',
        decision_threshold: 0.5,
        features: { url_length: url.length, is_https: url.startsWith('https') ? 1 : 0 },
        risk_factors: suspicious
          ? [{ code: 'suspicious_keywords', title: 'Suspicious keywords in the URL', description: 'Test fixture factor.', severity: 'high', feature: 'suspicious_keyword_count', value: 2, model_influence: 0.2 }]
          : [],
        contributions: [{ feature: 'url_length', value: url.length, baseline: 30, influence: suspicious ? 0.12 : -0.02 }],
        model: { name: 'random_forest', version: 'test-fixture-1', extractor_version: '1.0' },
      };
    },
    async modelInfo() {
      if (!state.available) return { status: 'unavailable' };
      if (!state.modelLoaded) return { status: 'model_not_loaded' };
      return {
        status: 'ok',
        info: {
          model_name: 'random_forest',
          model_version: 'test-fixture-1',
          algorithm: 'RandomForestClassifier + sigmoid calibration (TEST FIXTURE)',
          trained_at: '2026-01-01T00:00:00+00:00',
          extractor_version: '1.0',
          feature_count: 24,
          dataset: { name: 'TEST FIXTURE (not a real dataset)', records_used: 10 },
          metrics: { selected_model: 'random_forest', test: { accuracy: 0.5, n: 10 }, comparison: [] },
          risk_thresholds: { decision: 0.5, medium: 0.2, high: 0.9, method: 'test fixture' },
        },
      };
    },
    async health() {
      return !state.available ? 'unavailable' : state.modelLoaded ? 'ok' : 'model_not_loaded';
    },
  };
}

export async function setup(overrides = {}) {
  const config = testConfig(overrides);
  const pool = createPool(config);
  await resetDatabase(pool);
  const ml = createFakeMl();
  const app = createApp({ config, pool, ml });
  return { config, pool, ml, app, close: () => pool.end() };
}

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}${Date.now()}${counter++}@example.com`;

export async function registerUser(app, { name = 'Test User', email = uniqueEmail(), password = TEST_PASSWORD } = {}) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { email, password, user: res.body.user, accessToken: res.body.accessToken, cookie: refreshCookieHeader(res), res };
}

export async function registerAdmin(app, pool, opts = {}) {
  const u = await registerUser(app, { name: 'Admin User', email: uniqueEmail('admin'), ...opts });
  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [u.user.id]);
  return u;
}

/** "ls_refresh=...; Path=...; HttpOnly" -> "ls_refresh=..." (what a browser would send back). */
export function refreshCookieHeader(res) {
  const raw = (res.headers['set-cookie'] || []).find((c) => c.startsWith('ls_refresh='));
  return raw ? raw.split(';')[0] : null;
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export const binaryParser = (res, cb) => {
  res.setEncoding('binary');
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => cb(null, Buffer.from(data, 'binary')));
};
