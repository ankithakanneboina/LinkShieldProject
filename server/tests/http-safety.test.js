import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { bearer, registerUser, setup, testConfig } from './helpers.js';

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); });

describe('error handling', () => {
  it('uses the documented error shape for unknown routes', async () => {
    const res = await request(ctx.app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.deepEqual(Object.keys(res.body), ['error']);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('rejects malformed JSON with 400, not a stack trace', async () => {
    const res = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(!JSON.stringify(res.body).includes('node_modules'));
  });

  it('rejects oversized bodies', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'a@example.com', password: 'x'.repeat(40_000) });
    assert.equal(res.status, 413);
  });

  it('never leaks internals on unexpected failures', async () => {
    const original = console.error;
    console.error = () => {};
    const broken = await setup();
    try {
      const u = await registerUser(broken.app);
      await broken.pool.query('DROP TABLE scan_history CASCADE');
      const res = await request(broken.app).get('/api/dashboard').set(bearer(u.accessToken));
      assert.equal(res.status, 500);
      assert.equal(res.body.error.code, 'INTERNAL_ERROR');
      assert.ok(!/scan_history|relation|SELECT/i.test(JSON.stringify(res.body)));
    } finally {
      console.error = original;
      await broken.close();
    }
  });
});

describe('HTTP hardening', () => {
  it('sets security headers and hides the framework', async () => {
    const res = await request(ctx.app).get('/api/health');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
    assert.ok(res.headers['x-frame-options'] || /frame-ancestors/.test(res.headers['content-security-policy']));
  });

  it('allows configured origins with credentials and blocks others', async () => {
    const ok = await request(ctx.app).get('/api/health').set('Origin', 'http://localhost:5173');
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(ok.headers['access-control-allow-credentials'], 'true');
    const bad = await request(ctx.app).get('/api/health').set('Origin', 'https://evil.example');
    assert.equal(bad.status, 403);
    assert.equal(bad.headers['access-control-allow-origin'], undefined);
  });

  it('answers CORS preflight for allowed origins only', async () => {
    const ok = await request(ctx.app).options('/api/scan').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    assert.equal(ok.status, 204);
    const bad = await request(ctx.app).options('/api/scan').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    assert.equal(bad.status, 403);
  });
});

describe('configuration safety', () => {
  const base = { NODE_ENV: 'test', TEST_DATABASE_URL: 'postgres://x/test' };

  it('refuses to start without a strong JWT secret', () => {
    assert.throws(() => loadConfig({ ...base }), /JWT_ACCESS_SECRET/);
    assert.throws(() => loadConfig({ ...base, JWT_ACCESS_SECRET: 'short' }), /at least 32/);
  });

  it('refuses the placeholder secret from .env.example outside tests', () => {
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y', JWT_ACCESS_SECRET: 'replace-with-a-long-random-string-0123456789' }),
      /placeholder/,
    );
  });

  it('rejects wildcard CORS and disabled rate limiting in production', () => {
    const secret = 'k'.repeat(40);
    assert.throws(() => loadConfig({ ...base, JWT_ACCESS_SECRET: secret, CORS_ORIGINS: '*' }), /CORS_ORIGINS/);
    assert.throws(
      () => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y', JWT_ACCESS_SECRET: secret, RATE_LIMIT_DISABLED: 'true' }),
      /RATE_LIMIT_DISABLED/,
    );
  });

  it('uses secure cookies in production by default', () => {
    const cfg = loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y', JWT_ACCESS_SECRET: 'k'.repeat(40) });
    assert.equal(cfg.cookieSecure, true);
    assert.equal(cfg.bcryptRounds, 12);
  });

  it('testConfig points at the test database', () => {
    assert.ok(testConfig().databaseUrl);
  });
});

describe('migrations are repeatable', () => {
  it('running them again applies nothing and keeps the data', async () => {
    const { migrate } = await import('../scripts/migrate.js');
    const u = await registerUser(ctx.app);
    assert.deepEqual(await migrate(ctx.pool, { log: () => {} }), []);
    const { rows } = await ctx.pool.query('SELECT id FROM users WHERE id = $1', [u.user.id]);
    assert.equal(rows.length, 1);
  });
});
