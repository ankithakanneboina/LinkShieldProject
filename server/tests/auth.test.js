import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { TEST_PASSWORD, bearer, refreshCookieHeader, registerUser, setup, uniqueEmail } from './helpers.js';

let ctx;
before(async () => { ctx = await setup(); });
after(async () => { await ctx.close(); });

describe('POST /api/auth/register', () => {
  it('creates a user, returns tokens and a refresh cookie, and never returns the password hash', async () => {
    const email = uniqueEmail('Reg');
    const res = await request(ctx.app).post('/api/auth/register').send({ name: '  Ada Lovelace ', email: email.toUpperCase(), password: TEST_PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, email.toLowerCase());
    assert.equal(res.body.user.name, 'Ada Lovelace');
    assert.equal(res.body.user.role, 'user');
    assert.ok(res.body.accessToken && res.body.expiresIn > 0);
    assert.ok(!JSON.stringify(res.body).includes('password'));
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('ls_refresh='));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/api\/auth/);
  });

  it('stores a bcrypt hash, never the plain-text password', async () => {
    const { user } = await registerUser(ctx.app);
    const { rows } = await ctx.pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    assert.match(rows[0].password_hash, /^\$2[aby]\$\d\d\$/);
    assert.ok(!rows[0].password_hash.includes(TEST_PASSWORD));
  });

  it('stores only a hash of the refresh token', async () => {
    const { cookie, user } = await registerUser(ctx.app);
    const token = cookie.split('=')[1];
    const { rows } = await ctx.pool.query('SELECT token_hash FROM refresh_tokens WHERE user_id = $1', [user.id]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, token);
    assert.equal(rows[0].token_hash.length, 64);
  });

  it('rejects a duplicate email, case-insensitively, with a field error', async () => {
    const { email } = await registerUser(ctx.app);
    const res = await request(ctx.app).post('/api/auth/register').send({ name: 'Other', email: email.toUpperCase(), password: TEST_PASSWORD });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
    assert.equal(res.body.error.details[0].field, 'email');
  });

  it('ignores a client-supplied role: self-registration can never create an admin', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({ name: 'Mallory', email: uniqueEmail(), password: TEST_PASSWORD, role: 'admin', isActive: true });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'user');
  });

  for (const [label, body, field] of [
    ['short name', { name: 'A', email: 'a@example.com', password: TEST_PASSWORD }, 'name'],
    ['bad email', { name: 'Ada', email: 'not-an-email', password: TEST_PASSWORD }, 'email'],
    ['short password', { name: 'Ada', email: 'a@example.com', password: 'abc123' }, 'password'],
    ['password without a digit', { name: 'Ada', email: 'a@example.com', password: 'only-letters-here' }, 'password'],
    ['password without a letter', { name: 'Ada', email: 'a@example.com', password: '1234567890123' }, 'password'],
    ['password over 72 bytes', { name: 'Ada', email: 'a@example.com', password: `a1${'x'.repeat(80)}` }, 'password'],
    ['missing fields', {}, 'name'],
  ]) {
    it(`validates: ${label}`, async () => {
      const res = await request(ctx.app).post('/api/auth/register').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(res.body.error.details.some((d) => d.field === field), JSON.stringify(res.body.error.details));
    });
  }
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials (email is case-insensitive) and updates lastLoginAt', async () => {
    const { email, password } = await registerUser(ctx.app);
    const res = await request(ctx.app).post('/api/auth/login').send({ email: email.toUpperCase(), password });
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(refreshCookieHeader(res));
    assert.ok(res.body.user.lastLoginAt);
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const { email } = await registerUser(ctx.app);
    const wrong = await request(ctx.app).post('/api/auth/login').send({ email, password: 'wrong-password-9' });
    const unknown = await request(ctx.app).post('/api/auth/login').send({ email: uniqueEmail('nobody'), password: 'wrong-password-9' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('rejects a disabled account with 403 (only after the password is verified)', async () => {
    const { email, password, user } = await registerUser(ctx.app);
    await ctx.pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    assert.equal((await request(ctx.app).post('/api/auth/login').send({ email, password })).status, 403);
    assert.equal((await request(ctx.app).post('/api/auth/login').send({ email, password: 'wrong-password-9' })).status, 401);
  });

  it('validates the body', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'nope' });
    assert.equal(res.status, 400);
  });
});

describe('authentication middleware', () => {
  it('rejects missing, malformed and tampered tokens with 401', async () => {
    const { accessToken } = await registerUser(ctx.app);
    for (const headers of [{}, { Authorization: 'Bearer' }, { Authorization: 'Token abc' }, bearer('garbage'), bearer(`${accessToken}x`)]) {
      const res = await request(ctx.app).get('/api/auth/profile').set(headers);
      assert.equal(res.status, 401, JSON.stringify(headers));
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    }
  });

  it('reports an expired token as TOKEN_EXPIRED so the client can refresh', async () => {
    const { user } = await registerUser(ctx.app);
    const expired = jwt.sign({ role: 'user' }, ctx.config.jwtAccessSecret, { subject: user.id, expiresIn: -10 });
    const res = await request(ctx.app).get('/api/auth/profile').set(bearer(expired));
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
  });

  it('rejects tokens signed with another secret or the "none" algorithm', async () => {
    const { user } = await registerUser(ctx.app);
    const forged = jwt.sign({ role: 'admin' }, 'a-different-secret-a-different-secret!!', { subject: user.id });
    assert.equal((await request(ctx.app).get('/api/auth/profile').set(bearer(forged))).status, 401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'admin' })).toString('base64url')}.`;
    assert.equal((await request(ctx.app).get('/api/auth/profile').set(bearer(none))).status, 401);
  });

  it('takes the role from the database, not from the token claim', async () => {
    const { user } = await registerUser(ctx.app);
    const claimsAdmin = jwt.sign({ role: 'admin' }, ctx.config.jwtAccessSecret, { subject: user.id, expiresIn: 60 });
    const res = await request(ctx.app).get('/api/admin/users').set(bearer(claimsAdmin));
    assert.equal(res.status, 403);
  });

  it('stops honouring a valid token as soon as the account is disabled', async () => {
    const { accessToken, user } = await registerUser(ctx.app);
    assert.equal((await request(ctx.app).get('/api/auth/profile').set(bearer(accessToken))).status, 200);
    await ctx.pool.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    assert.equal((await request(ctx.app).get('/api/auth/profile').set(bearer(accessToken))).status, 403);
  });
});

describe('profile', () => {
  it('returns the profile with scanCount, and updates the name', async () => {
    const { accessToken } = await registerUser(ctx.app, { name: 'Before Name' });
    const get = await request(ctx.app).get('/api/auth/profile').set(bearer(accessToken));
    assert.equal(get.status, 200);
    assert.equal(get.body.user.scanCount, 0);
    const patch = await request(ctx.app).patch('/api/auth/profile').set(bearer(accessToken)).send({ name: 'After Name' });
    assert.equal(patch.status, 200);
    assert.equal(patch.body.user.name, 'After Name');
    assert.equal((await request(ctx.app).patch('/api/auth/profile').set(bearer(accessToken)).send({ name: 'x' })).status, 400);
  });
});

describe('refresh tokens', () => {
  it('rotates the refresh token and issues a working access token', async () => {
    const { cookie } = await registerUser(ctx.app);
    const res = await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal(res.status, 200);
    const next = refreshCookieHeader(res);
    assert.ok(next && next !== cookie);
    assert.equal((await request(ctx.app).get('/api/auth/profile').set(bearer(res.body.accessToken))).status, 200);
  });

  it('rejects a missing or unknown refresh token with 401', async () => {
    assert.equal((await request(ctx.app).post('/api/auth/refresh')).status, 401);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', 'ls_refresh=not-a-real-token')).status, 401);
  });

  it('detects reuse of a rotated token and revokes every session of that user', async () => {
    const { cookie: first, user } = await registerUser(ctx.app);
    const rotated = await request(ctx.app).post('/api/auth/refresh').set('Cookie', first);
    const second = refreshCookieHeader(rotated);
    // Pretend the old token was revoked long ago (outside the benign-race grace window), then replay it.
    await ctx.pool.query("UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute' WHERE revoked_at IS NOT NULL AND user_id = $1", [user.id]);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', first)).status, 401);
    // ... which also kills the legitimate newer token.
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', second)).status, 401);
  });

  it('does not treat an immediate replay (two tabs racing) as theft', async () => {
    const { cookie } = await registerUser(ctx.app);
    const a = await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', refreshCookieHeader(a))).status, 200);
  });

  it('rejects an expired refresh token', async () => {
    const { cookie, user } = await registerUser(ctx.app);
    await ctx.pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE user_id = $1", [user.id]);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
  });
});

describe('logout and password change', () => {
  it('logout revokes the refresh token, clears the cookie and is idempotent', async () => {
    const { cookie } = await registerUser(ctx.app);
    const out = await request(ctx.app).post('/api/auth/logout').set('Cookie', cookie);
    assert.equal(out.status, 204);
    assert.match(out.headers['set-cookie'].join(';'), /ls_refresh=;/);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
    assert.equal((await request(ctx.app).post('/api/auth/logout').set('Cookie', cookie)).status, 204);
    assert.equal((await request(ctx.app).post('/api/auth/logout')).status, 204);
  });

  it('changing the password requires the current one, revokes all sessions and enables the new password', async () => {
    const { email, password, accessToken, cookie } = await registerUser(ctx.app);
    const bad = await request(ctx.app).post('/api/auth/change-password').set(bearer(accessToken)).send({ currentPassword: 'wrong-password-9', newPassword: 'brand-new-pass-2' });
    assert.equal(bad.status, 401);
    const weak = await request(ctx.app).post('/api/auth/change-password').set(bearer(accessToken)).send({ currentPassword: password, newPassword: 'weak' });
    assert.equal(weak.status, 400);

    const ok = await request(ctx.app).post('/api/auth/change-password').set(bearer(accessToken)).send({ currentPassword: password, newPassword: 'brand-new-pass-2' });
    assert.equal(ok.status, 204);
    assert.equal((await request(ctx.app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401);
    assert.equal((await request(ctx.app).post('/api/auth/login').send({ email, password })).status, 401);
    assert.equal((await request(ctx.app).post('/api/auth/login').send({ email, password: 'brand-new-pass-2' })).status, 200);
  });
});

describe('rate limiting', () => {
  it('limits repeated login attempts with 429 RATE_LIMITED', async () => {
    const limited = await setup({ RATE_LIMIT_DISABLED: 'false', RATE_LIMIT_AUTH_PER_15_MIN: '3' });
    try {
      const body = { email: 'nobody@example.com', password: 'wrong-password-9' };
      for (let i = 0; i < 3; i++) assert.equal((await request(limited.app).post('/api/auth/login').send(body)).status, 401);
      const res = await request(limited.app).post('/api/auth/login').send(body);
      assert.equal(res.status, 429);
      assert.equal(res.body.error.code, 'RATE_LIMITED');
    } finally {
      await limited.close();
    }
  });
});
