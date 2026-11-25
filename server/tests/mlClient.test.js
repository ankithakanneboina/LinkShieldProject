import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createMlClient, validatePrediction } from '../src/services/mlClient.js';

const config = loadConfig({
  NODE_ENV: 'test',
  TEST_DATABASE_URL: 'postgres://x/test',
  JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123456',
  ML_SERVICE_URL: 'http://ml.internal:8000/',
  ML_TIMEOUT_MS: '500',
});

const goodPrediction = () => ({
  prediction: 'phishing', phishing_probability: 0.9, risk_score: 90, risk_category: 'high', features: { a: 1 },
  risk_factors: [{ code: 'c', title: 't', description: 'd', severity: 'high' }], contributions: [],
  model: { name: 'random_forest', version: 'v', extractor_version: '1.0' },
});
const reply = (status, body) => async () => ({ status, json: async () => body });

describe('ML client', () => {
  it('posts the URL as JSON to the configured service and returns a validated prediction', async () => {
    let seen;
    const ml = createMlClient(config, async (url, init) => {
      seen = { url, init };
      return { status: 200, json: async () => goodPrediction() };
    });
    const p = await ml.predict('https://example.com');
    assert.equal(seen.url, 'http://ml.internal:8000/predict'); // trailing slash trimmed
    assert.equal(seen.init.method, 'POST');
    assert.equal(seen.init.redirect, 'error'); // redirects are never followed
    assert.deepEqual(JSON.parse(seen.init.body), { url: 'https://example.com' });
    assert.equal(p.prediction, 'phishing');
  });

  it('maps an ML 400 INVALID_URL to a 400 API error', async () => {
    const ml = createMlClient(config, reply(400, { error: { code: 'INVALID_URL', message: 'URL has no host' } }));
    await assert.rejects(ml.predict('x'), (e) => e.status === 400 && e.code === 'INVALID_URL' && e.message === 'URL has no host');
  });

  it('maps "no model" and other failures to 503 ML_SERVICE_UNAVAILABLE', async () => {
    const noModel = createMlClient(config, reply(503, { error: { code: 'MODEL_NOT_LOADED', message: 'x' } }));
    await assert.rejects(noModel.predict('https://a.com'), (e) => e.status === 503 && e.code === 'ML_SERVICE_UNAVAILABLE' && /trained/i.test(e.message));
    const boom = createMlClient(config, reply(500, null));
    await assert.rejects(boom.predict('https://a.com'), (e) => e.status === 503);
  });

  it('maps network errors and timeouts to 503', async () => {
    const down = createMlClient(config, async () => { throw new Error('ECONNREFUSED'); });
    await assert.rejects(down.predict('https://a.com'), (e) => e.status === 503);
    const slow = createMlClient(config, (_u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))));
    await assert.rejects(slow.predict('https://a.com'), (e) => e.status === 503);
  });

  it('rejects malformed ML responses instead of storing them', () => {
    assert.throws(() => validatePrediction({ ...goodPrediction(), prediction: 'maybe' }), (e) => e.status === 503);
    assert.throws(() => validatePrediction({ ...goodPrediction(), phishing_probability: 1.5 }), (e) => e.status === 503);
    assert.throws(() => validatePrediction({ ...goodPrediction(), risk_score: 50.5 }), (e) => e.status === 503);
    assert.throws(() => validatePrediction({ ...goodPrediction(), risk_category: 'extreme' }), (e) => e.status === 503);
    assert.throws(() => validatePrediction(null), (e) => e.status === 503);
    assert.doesNotThrow(() => validatePrediction(goodPrediction()));
  });

  it('modelInfo and health never throw', async () => {
    const down = createMlClient(config, async () => { throw new Error('down'); });
    assert.deepEqual(await down.modelInfo(), { status: 'unavailable' });
    assert.equal(await down.health(), 'unavailable');
    const notLoaded = createMlClient(config, reply(200, { status: 'ok', model_loaded: false }));
    assert.equal(await notLoaded.health(), 'model_not_loaded');
  });
});
