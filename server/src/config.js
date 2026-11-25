/**
 * Environment configuration. `loadConfig` is a pure function of the environment so tests can pass their own values.
 * Secrets are never given defaults: a missing or placeholder secret stops the server at startup.
 */
const PLACEHOLDER = /(replace[-_ ]with|change[-_ ]?me|your[-_ ]secret|example)/i;

function int(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}

function bool(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes'].includes(String(raw).toLowerCase());
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const databaseUrl = isTest ? env.TEST_DATABASE_URL || env.DATABASE_URL : env.DATABASE_URL;
  if (!databaseUrl) throw new Error(isTest ? 'TEST_DATABASE_URL is required to run tests' : 'DATABASE_URL is required');

  const jwtAccessSecret = env.JWT_ACCESS_SECRET || '';
  if (jwtAccessSecret.length < 32) throw new Error('JWT_ACCESS_SECRET must be set to a random string of at least 32 characters');
  if (!isTest && PLACEHOLDER.test(jwtAccessSecret)) {
    throw new Error('JWT_ACCESS_SECRET still contains the placeholder from .env.example; generate a real secret');
  }

  const mlServiceUrl = (env.ML_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/\s]+$/i.test(mlServiceUrl)) throw new Error('ML_SERVICE_URL must look like http://host:port');

  const corsOrigins = (env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (corsOrigins.includes('*')) throw new Error('CORS_ORIGINS must list explicit origins (credentials are enabled)');

  const rateLimitDisabled = bool(env, 'RATE_LIMIT_DISABLED', isTest);
  if (isProd && rateLimitDisabled) throw new Error('RATE_LIMIT_DISABLED must not be enabled in production');

  return {
    nodeEnv,
    isProd,
    isTest,
    port: int(env, 'PORT', 4000, { min: 1, max: 65535 }),
    databaseUrl,
    databaseSsl: bool(env, 'DATABASE_SSL', false),
    jwtAccessSecret,
    accessTtlSeconds: int(env, 'ACCESS_TOKEN_TTL_SECONDS', 900, { min: 60, max: 86400 }),
    refreshTtlDays: int(env, 'REFRESH_TOKEN_TTL_DAYS', 7, { min: 1, max: 90 }),
    bcryptRounds: int(env, 'BCRYPT_ROUNDS', isTest ? 4 : 12, { min: 4, max: 15 }),
    cookieSecure: bool(env, 'COOKIE_SECURE', isProd),
    corsOrigins,
    trustProxy: env.TRUST_PROXY === undefined || env.TRUST_PROXY === '' ? false : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY === 'true',
    mlServiceUrl,
    mlTimeoutMs: int(env, 'ML_TIMEOUT_MS', 8000, { min: 500, max: 60000 }),
    clientDir: env.SERVE_CLIENT_DIR || '',
    rateLimit: {
      disabled: rateLimitDisabled,
      globalPerMinute: int(env, 'RATE_LIMIT_GLOBAL_PER_MINUTE', 300, { min: 10 }),
      authPer15Min: int(env, 'RATE_LIMIT_AUTH_PER_15_MIN', 20, { min: 1 }),
      scanPerMinute: int(env, 'RATE_LIMIT_SCAN_PER_MINUTE', 30, { min: 1 }),
    },
  };
}
