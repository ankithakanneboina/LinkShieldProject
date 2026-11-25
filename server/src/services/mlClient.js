import { AppError, mlUnavailable } from '../utils/errors.js';
import { PREDICTIONS, RISK_CATEGORIES, SEVERITIES } from '../constants.js';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Guards against a misbehaving ML service: anything malformed is rejected instead of being stored. */
export function validatePrediction(p) {
  const ok =
    isObj(p) &&
    PREDICTIONS.includes(p.prediction) &&
    typeof p.phishing_probability === 'number' && p.phishing_probability >= 0 && p.phishing_probability <= 1 &&
    Number.isInteger(p.risk_score) && p.risk_score >= 0 && p.risk_score <= 100 &&
    RISK_CATEGORIES.includes(p.risk_category) &&
    isObj(p.features) &&
    Array.isArray(p.risk_factors) &&
    p.risk_factors.every((f) => isObj(f) && typeof f.code === 'string' && typeof f.title === 'string' && typeof f.description === 'string' && SEVERITIES.includes(f.severity)) &&
    Array.isArray(p.contributions) &&
    isObj(p.model) && typeof p.model.name === 'string' && typeof p.model.version === 'string' && typeof p.model.extractor_version === 'string';
  if (!ok) throw mlUnavailable('The analysis service returned an unexpected response.');
  return p;
}

/**
 * Client for the internal FastAPI service. The only outbound request LinkShield ever makes is to this fixed, configured
 * address; submitted URLs are sent as JSON *text* and are never fetched. Redirects are refused.
 */
export function createMlClient(config, fetchImpl = globalThis.fetch) {
  async function call(path, { method = 'GET', body, timeoutMs = config.mlTimeoutMs } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${config.mlServiceUrl}${path}`, {
        method,
        headers: body ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        redirect: 'error',
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        /* non-JSON error body */
      }
      return { status: res.status, payload };
    } catch {
      throw mlUnavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async predict(url) {
      const { status, payload } = await call('/predict', { method: 'POST', body: { url } });
      if (status === 200) return validatePrediction(payload);
      if (status === 400 && payload?.error?.code === 'INVALID_URL') throw new AppError(400, 'INVALID_URL', payload.error.message);
      if (status === 503 && payload?.error?.code === 'MODEL_NOT_LOADED') {
        throw mlUnavailable('No trained model is available yet. Train the model first (see the README), then try again.');
      }
      throw mlUnavailable();
    },

    /** @returns {{status: 'ok', info: object} | {status: 'model_not_loaded' | 'unavailable'}} never throws */
    async modelInfo() {
      try {
        const { status, payload } = await call('/model-info', { timeoutMs: Math.min(config.mlTimeoutMs, 4000) });
        if (status === 200 && isObj(payload) && typeof payload.model_version === 'string') return { status: 'ok', info: payload };
        if (status === 503 && payload?.error?.code === 'MODEL_NOT_LOADED') return { status: 'model_not_loaded' };
        return { status: 'unavailable' };
      } catch {
        return { status: 'unavailable' };
      }
    },

    /** @returns {'ok' | 'model_not_loaded' | 'unavailable'} never throws */
    async health() {
      try {
        const { status, payload } = await call('/health', { timeoutMs: 2000 });
        if (status !== 200 || !isObj(payload)) return 'unavailable';
        return payload.model_loaded ? 'ok' : 'model_not_loaded';
      } catch {
        return 'unavailable';
      }
    },
  };
}
