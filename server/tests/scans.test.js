import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { bearer, binaryParser, registerAdmin, registerUser, setup } from './helpers.js';

let ctx;
let user;
before(async () => {
  ctx = await setup();
  user = await registerUser(ctx.app);
});
after(async () => { await ctx.close(); });

const scan = (url, token = user.accessToken) => request(ctx.app).post('/api/scan').set(bearer(token)).send({ url });
const count = async (table, where = '', params = []) => (await ctx.pool.query(`SELECT count(*)::int AS n FROM ${table} ${where}`, params)).rows[0].n;

describe('POST /api/scan', () => {
  it('requires authentication', async () => {
    assert.equal((await request(ctx.app).post('/api/scan').send({ url: 'https://example.com' })).status, 401);
  });

  it('validates, predicts and stores the scan in PostgreSQL (scan + features + risk factors)', async () => {
    const before = await count('scan_history');
    const res = await scan('paypal.com.secure-login.example.tk/verify');
    assert.equal(res.status, 201);
    const s = res.body.scan;
    assert.equal(s.submittedUrl, 'paypal.com.secure-login.example.tk/verify');
    assert.equal(s.normalizedUrl, 'https://paypal.com.secure-login.example.tk/verify');
    assert.equal(s.schemeAssumed, true);
    assert.equal(s.prediction, 'phishing');
    assert.equal(s.riskCategory, 'high');
    assert.equal(s.riskScore, 97);
    assert.equal(s.modelVersion, 'test-fixture-1');
    assert.ok(s.scannedAt);
    assert.equal(s.riskFactors[0].code, 'suspicious_keywords');
    assert.ok(Array.isArray(s.contributions));
    assert.deepEqual(ctx.ml.state.calls.at(-1), 'https://paypal.com.secure-login.example.tk/verify');

    assert.equal(await count('scan_history'), before + 1);
    assert.equal(await count('url_features', 'WHERE scan_id = $1', [s.id]), 1);
    assert.equal(await count('risk_factors', 'WHERE scan_id = $1', [s.id]), 1);
    const owner = await ctx.pool.query('SELECT user_id FROM scan_history WHERE id = $1', [s.id]);
    assert.equal(owner.rows[0].user_id, user.user.id);
  });

  it('stores a legitimate result without risk factors', async () => {
    const res = await scan('https://www.example.com/');
    assert.equal(res.status, 201);
    assert.equal(res.body.scan.prediction, 'legitimate');
    assert.deepEqual(res.body.scan.riskFactors, []);
  });

  for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.com', 'http://', 'http://exa mple.com', 'a'.repeat(2100)]) {
    it(`rejects ${JSON.stringify(bad.slice(0, 30))} with INVALID_URL and stores nothing`, async () => {
      const callsBefore = ctx.ml.state.calls.length;
      const rows = await count('scan_history');
      const res = await scan(bad);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_URL');
      assert.equal(ctx.ml.state.calls.length, callsBefore, 'the ML service must not be called for an invalid URL');
      assert.equal(await count('scan_history'), rows);
    });
  }

  it('rejects a missing or non-string url with VALIDATION_ERROR', async () => {
    for (const body of [{}, { url: 5 }, { url: null }]) {
      const res = await request(ctx.app).post('/api/scan').set(bearer(user.accessToken)).send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('returns 503 and stores nothing when the ML service is down', async () => {
    const rows = await count('scan_history');
    ctx.ml.state.available = false;
    try {
      const res = await scan('https://down.example.com');
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'ML_SERVICE_UNAVAILABLE');
      assert.equal(await count('scan_history'), rows);
    } finally {
      ctx.ml.state.available = true;
    }
  });

  it('never fetches the submitted URL: the only thing the backend does with it is hand the text to the ML client', async () => {
    const original = globalThis.fetch;
    const seen = [];
    globalThis.fetch = async (url) => { seen.push(String(url)); throw new Error('network is not available in tests'); };
    try {
      const res = await scan('http://169.254.169.254/latest/meta-data/');
      assert.equal(res.status, 201); // classified purely as text (fake ML is injected, so no fetch at all)
      assert.deepEqual(seen, []);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('scan history', () => {
  let history;
  before(async () => {
    history = await registerUser(ctx.app);
    const urls = ['https://alpha.example.com/a', 'http://phish-login.example.tk/verify', 'https://beta.example.org/50%_off', 'http://192.168.1.5/login', 'https://gamma.example.net'];
    for (const u of urls) {
      const r = await scan(u, history.accessToken);
      assert.equal(r.status, 201);
    }
  });
  const list = (qs = '') => request(ctx.app).get(`/api/scans${qs}`).set(bearer(history.accessToken));

  it('lists only the caller\'s scans, newest first, with pagination', async () => {
    const res = await list('?limit=2');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    assert.deepEqual(res.body.pagination, { page: 1, limit: 2, total: 5, totalPages: 3 });
    assert.ok(new Date(res.body.data[0].scannedAt) >= new Date(res.body.data[1].scannedAt));
    assert.equal((await list('?limit=2&page=3')).body.data.length, 1);
    assert.equal((await list('?limit=2&page=9')).body.data.length, 0);
  });

  it('sorts oldest first', async () => {
    const res = await list('?sort=oldest');
    assert.equal(res.body.data[0].normalizedUrl, 'https://alpha.example.com/a');
  });

  it('filters by prediction and risk category', async () => {
    const phishing = await list('?prediction=phishing');
    assert.equal(phishing.body.pagination.total, 2);
    assert.ok(phishing.body.data.every((s) => s.prediction === 'phishing'));
    assert.equal((await list('?risk=low')).body.pagination.total, 3);
    assert.equal((await list('?prediction=legitimate&risk=high')).body.pagination.total, 0);
  });

  it('searches URLs case-insensitively and treats % and _ literally', async () => {
    assert.equal((await list('?search=ALPHA')).body.pagination.total, 1);
    assert.equal((await list('?search=50%25_')).body.pagination.total, 1);
    assert.equal((await list('?search=%25')).body.pagination.total, 1);
    assert.equal((await list(`?search=${encodeURIComponent("'; DROP TABLE users;--")}`)).body.pagination.total, 0);
    assert.ok((await count('users')) > 0);
  });

  it('rejects invalid query parameters', async () => {
    for (const qs of ['?page=0', '?limit=1000', '?limit=abc', '?prediction=maybe', '?risk=extreme', '?sort=random']) {
      const res = await list(qs);
      assert.equal(res.status, 400, qs);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    }
  });

  it('treats empty filter values as "no filter"', async () => {
    assert.equal((await list('?search=&prediction=&risk=&sort=')).body.pagination.total, 5);
  });
});

describe('scan detail and delete', () => {
  it('returns the stored detail', async () => {
    const created = (await scan('https://detail.example.com/path')).body.scan;
    const res = await request(ctx.app).get(`/api/scans/${created.id}`).set(bearer(user.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.scan.id, created.id);
    assert.equal(res.body.scan.features.url_length, 'https://detail.example.com/path'.length);
    assert.equal(res.body.scan.feedback, null);
  });

  it('returns 404 for unknown and malformed ids', async () => {
    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid', '1']) {
      assert.equal((await request(ctx.app).get(`/api/scans/${id}`).set(bearer(user.accessToken))).status, 404, id);
    }
  });

  it('deletes a scan and cascades to its features, risk factors and feedback', async () => {
    const created = (await scan('https://delete-me.example.com/login')).body.scan;
    await request(ctx.app).post('/api/feedback').set(bearer(user.accessToken)).send({ scanId: created.id, category: 'correct' });
    const del = await request(ctx.app).delete(`/api/scans/${created.id}`).set(bearer(user.accessToken));
    assert.equal(del.status, 204);
    for (const [table, col] of [['scan_history', 'id'], ['url_features', 'scan_id'], ['risk_factors', 'scan_id'], ['user_feedback', 'scan_id']]) {
      assert.equal(await count(table, `WHERE ${col} = $1`, [created.id]), 0, table);
    }
    assert.equal((await request(ctx.app).delete(`/api/scans/${created.id}`).set(bearer(user.accessToken))).status, 404);
  });
});

describe('dashboard and analytics (real aggregates)', () => {
  it('gives a new user zeros and zero-filled series (empty state)', async () => {
    const fresh = await registerUser(ctx.app);
    const res = await request(ctx.app).get('/api/dashboard').set(bearer(fresh.accessToken));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.totals, { totalScans: 0, phishingCount: 0, legitimateCount: 0, highRiskCount: 0 });
    assert.deepEqual(res.body.recentScans, []);
    assert.equal(res.body.dailyActivity.length, 14);
    assert.equal(res.body.weeklyTrend.length, 8);
    assert.deepEqual(res.body.riskDistribution.map((r) => r.category), ['low', 'medium', 'high']);
  });

  it('computes totals, trends and distribution from the user\'s stored scans', async () => {
    const u = await registerUser(ctx.app);
    await scan('https://ok.example.com', u.accessToken);
    await scan('https://ok2.example.com', u.accessToken);
    await scan('http://phish.example.tk/login', u.accessToken);
    const res = await request(ctx.app).get('/api/dashboard').set(bearer(u.accessToken));
    assert.deepEqual(res.body.totals, { totalScans: 3, phishingCount: 1, legitimateCount: 2, highRiskCount: 1 });
    assert.equal(res.body.recentScans.length, 3);
    const today = res.body.dailyActivity.at(-1);
    assert.deepEqual([today.total, today.phishing, today.legitimate], [3, 1, 2]);
    assert.equal(res.body.weeklyTrend.reduce((s, w) => s + w.total, 0), 3);
    assert.deepEqual(res.body.riskDistribution.map((r) => r.count), [2, 0, 1]);
  });

  it('serves analytics for 7/30/90 days and rejects other ranges', async () => {
    for (const range of [7, 30, 90]) {
      const res = await request(ctx.app).get(`/api/analytics?range=${range}`).set(bearer(user.accessToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.range, range);
      assert.equal(res.body.dailySeries.length, range);
      assert.equal(res.body.riskScoreBuckets.length, 10);
    }
    assert.equal((await request(ctx.app).get('/api/analytics').set(bearer(user.accessToken))).body.range, 30);
    assert.equal((await request(ctx.app).get('/api/analytics?range=5').set(bearer(user.accessToken))).status, 400);
  });
});

describe('feedback', () => {
  it('stores feedback for the owner, updates it on resubmission, and shows it on the scan', async () => {
    const s = (await scan('https://fb.example.com')).body.scan;
    const first = await request(ctx.app).post('/api/feedback').set(bearer(user.accessToken)).send({ scanId: s.id, category: 'false_positive', comments: '  It is my site  ' });
    assert.equal(first.status, 201);
    assert.equal(first.body.feedback.comments, 'It is my site');
    assert.ok(first.body.feedback.createdAt);
    const second = await request(ctx.app).post('/api/feedback').set(bearer(user.accessToken)).send({ scanId: s.id, category: 'correct', comments: '' });
    assert.equal(second.status, 200);
    assert.equal(second.body.feedback.id, first.body.feedback.id);
    assert.equal(second.body.feedback.comments, null);
    assert.equal(await count('user_feedback', 'WHERE scan_id = $1', [s.id]), 1);
    const detail = await request(ctx.app).get(`/api/scans/${s.id}`).set(bearer(user.accessToken));
    assert.equal(detail.body.scan.feedback.category, 'correct');
  });

  it('validates category, id and comment length', async () => {
    const s = (await scan('https://fb2.example.com')).body.scan;
    const post = (body) => request(ctx.app).post('/api/feedback').set(bearer(user.accessToken)).send(body);
    assert.equal((await post({ scanId: s.id, category: 'nonsense' })).status, 400);
    assert.equal((await post({ scanId: 'nope', category: 'correct' })).status, 400);
    assert.equal((await post({ scanId: s.id, category: 'other', comments: 'x'.repeat(1001) })).status, 400);
    assert.equal((await post({ category: 'correct' })).status, 400);
  });

  it('never alters a scan\'s stored prediction (feedback is not ground truth)', async () => {
    const s = (await scan('http://phish.fb3.example.tk/login')).body.scan;
    await request(ctx.app).post('/api/feedback').set(bearer(user.accessToken)).send({ scanId: s.id, category: 'false_positive' });
    const row = (await ctx.pool.query('SELECT prediction, risk_score FROM scan_history WHERE id = $1', [s.id])).rows[0];
    assert.deepEqual(row, { prediction: 'phishing', risk_score: 97 });
  });
});

describe('PDF report', () => {
  it('generates a real PDF from the stored scan for its owner', async () => {
    const s = (await scan('http://phish.report.example.tk/login?x=1')).body.scan;
    const res = await request(ctx.app).get(`/api/reports/${s.id}/pdf`).set(bearer(user.accessToken)).buffer().parse(binaryParser);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], new RegExp(`attachment; filename="linkshield-report-${s.id.slice(0, 8)}\\.pdf"`));
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
    assert.ok(res.body.length > 1500);
    assert.match(res.body.subarray(-32).toString(), /%%EOF/);
  });

  it('renders URLs with non-Latin characters without failing', async () => {
    const s = (await scan('https://аpple.example.com/пароль')).body.scan; // Cyrillic look-alike characters
    const res = await request(ctx.app).get(`/api/reports/${s.id}/pdf`).set(bearer(user.accessToken)).buffer().parse(binaryParser);
    assert.equal(res.status, 200);
    assert.equal(res.body.subarray(0, 5).toString(), '%PDF-');
  });

  it('requires authentication and returns 404 for unknown ids', async () => {
    const s = (await scan('https://pdf-auth.example.com')).body.scan;
    assert.equal((await request(ctx.app).get(`/api/reports/${s.id}/pdf`)).status, 401);
    assert.equal((await request(ctx.app).get('/api/reports/00000000-0000-4000-8000-000000000000/pdf').set(bearer(user.accessToken))).status, 404);
  });
});

describe('admin reads real platform data', () => {
  it('reports platform totals, users, scans, feedback, model info and activity', async () => {
    const admin = await registerAdmin(ctx.app, ctx.pool);
    const get = (path) => request(ctx.app).get(path).set(bearer(admin.accessToken));

    const analytics = await get('/api/admin/analytics');
    assert.equal(analytics.status, 200);
    assert.equal(analytics.body.totals.totalScans, await count('scan_history'));
    assert.equal(analytics.body.totals.totalUsers, await count('users'));

    const users = await get('/api/admin/users?limit=50');
    assert.equal(users.body.pagination.total, await count('users'));
    assert.ok(users.body.data.every((u) => typeof u.scanCount === 'number' && !('passwordHash' in u)));
    assert.equal((await get(`/api/admin/users?search=${encodeURIComponent(admin.email)}`)).body.pagination.total, 1);

    const scans = await get('/api/admin/scans?limit=50');
    assert.equal(scans.body.pagination.total, await count('scan_history'));
    assert.ok(scans.body.data.every((s) => s.user?.email));

    const feedback = await get('/api/admin/feedback');
    assert.equal(feedback.body.pagination.total, await count('user_feedback'));
    assert.equal((await get('/api/admin/feedback?category=false_positive')).status, 200);

    const model = await get('/api/admin/model');
    assert.equal(model.status, 200);
    assert.equal(model.body.service.status, 'ok');
    assert.equal(model.body.active.modelVersion, 'test-fixture-1');
    assert.equal(await count('model_information', 'WHERE is_active'), 1);

    const activity = await get('/api/admin/activity?limit=10');
    assert.equal(activity.status, 200);
    assert.ok(activity.body.data.length > 0 && activity.body.data.length <= 10);
    assert.ok(['scan', 'registration', 'feedback'].includes(activity.body.data[0].type));
  });

  it('reports "no model" honestly when the ML service has none', async () => {
    const admin = await registerAdmin(ctx.app, ctx.pool);
    await ctx.pool.query('DELETE FROM model_information');
    ctx.ml.state.modelLoaded = false;
    try {
      const res = await request(ctx.app).get('/api/admin/model').set(bearer(admin.accessToken));
      assert.equal(res.body.service.status, 'model_not_loaded');
      assert.equal(res.body.active, null);
    } finally {
      ctx.ml.state.modelLoaded = true;
    }
  });
});

describe('GET /api/health', () => {
  it('reports database and ML status', async () => {
    const res = await request(ctx.app).get('/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok', database: 'ok', mlService: 'ok' });
    ctx.ml.state.available = false;
    assert.equal((await request(ctx.app).get('/api/health')).body.mlService, 'unavailable');
    ctx.ml.state.available = true;
  });
});
