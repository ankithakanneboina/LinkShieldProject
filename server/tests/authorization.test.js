import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { bearer, binaryParser, registerAdmin, registerUser, setup } from './helpers.js';

let ctx;
let alice;
let bob;
let admin;
let aliceScan;

before(async () => {
  ctx = await setup();
  alice = await registerUser(ctx.app, { name: 'Alice' });
  bob = await registerUser(ctx.app, { name: 'Bob' });
  admin = await registerAdmin(ctx.app, ctx.pool);
  const res = await request(ctx.app).post('/api/scan').set(bearer(alice.accessToken)).send({ url: 'http://phish.alice.example.tk/login' });
  aliceScan = res.body.scan;
  await request(ctx.app).post('/api/scan').set(bearer(bob.accessToken)).send({ url: 'https://bob.example.com' });
});
after(async () => { await ctx.close(); });

describe("users can only touch their own records (enforced by the API, not the UI)", () => {
  it("another user's scan looks exactly like a missing one (404, no information leak)", async () => {
    const other = await request(ctx.app).get(`/api/scans/${aliceScan.id}`).set(bearer(bob.accessToken));
    const missing = await request(ctx.app).get('/api/scans/00000000-0000-4000-8000-000000000000').set(bearer(bob.accessToken));
    assert.equal(other.status, 404);
    assert.deepEqual(other.body, { error: { code: 'NOT_FOUND', message: 'Scan not found' } });
    assert.deepEqual(other.body, missing.body);
  });

  it("cannot delete another user's scan, and it survives", async () => {
    const res = await request(ctx.app).delete(`/api/scans/${aliceScan.id}`).set(bearer(bob.accessToken));
    assert.equal(res.status, 404);
    const still = await request(ctx.app).get(`/api/scans/${aliceScan.id}`).set(bearer(alice.accessToken));
    assert.equal(still.status, 200);
  });

  it("cannot download another user's PDF report", async () => {
    const res = await request(ctx.app).get(`/api/reports/${aliceScan.id}/pdf`).set(bearer(bob.accessToken)).buffer().parse(binaryParser);
    assert.equal(res.status, 404);
  });

  it("cannot leave feedback on another user's scan", async () => {
    const res = await request(ctx.app).post('/api/feedback').set(bearer(bob.accessToken)).send({ scanId: aliceScan.id, category: 'other', comments: 'hi' });
    assert.equal(res.status, 404);
    assert.equal((await ctx.pool.query('SELECT count(*)::int AS n FROM user_feedback')).rows[0].n, 0);
  });

  it("history, dashboard and analytics never include other users' scans", async () => {
    const list = await request(ctx.app).get('/api/scans').set(bearer(bob.accessToken));
    assert.equal(list.body.pagination.total, 1);
    assert.ok(list.body.data.every((s) => !s.normalizedUrl.includes('alice')));
    const dash = await request(ctx.app).get('/api/dashboard').set(bearer(bob.accessToken));
    assert.equal(dash.body.totals.totalScans, 1);
    assert.equal(dash.body.totals.phishingCount, 0);
    const analytics = await request(ctx.app).get('/api/analytics?range=90').set(bearer(bob.accessToken));
    assert.equal(analytics.body.totals.totalScans, 1);
    assert.ok(analytics.body.topDomains.every((d) => !d.hostname.includes('alice')));
  });

  it('a user_id supplied by the client is ignored', async () => {
    const res = await request(ctx.app).get(`/api/scans?userId=${alice.user.id}`).set(bearer(bob.accessToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.total, 1);
  });

  it("an admin has no special access to a user's private scan detail through the user endpoint", async () => {
    const res = await request(ctx.app).get(`/api/scans/${aliceScan.id}`).set(bearer(admin.accessToken));
    assert.equal(res.status, 404);
  });
});

describe('role-based access control on /api/admin/*', () => {
  const adminGets = ['/api/admin/users', '/api/admin/scans', '/api/admin/analytics', '/api/admin/feedback', '/api/admin/model', '/api/admin/activity'];

  for (const path of adminGets) {
    it(`${path}: 401 without a token, 403 for a normal user, 200 for an admin`, async () => {
      assert.equal((await request(ctx.app).get(path)).status, 401);
      const forbidden = await request(ctx.app).get(path).set(bearer(alice.accessToken));
      assert.equal(forbidden.status, 403);
      assert.equal(forbidden.body.error.code, 'FORBIDDEN');
      assert.equal((await request(ctx.app).get(path).set(bearer(admin.accessToken))).status, 200);
    });
  }

  it('a normal user cannot become admin by any API call', async () => {
    await request(ctx.app).patch('/api/auth/profile').set(bearer(alice.accessToken)).send({ name: 'Alice', role: 'admin' });
    const { rows } = await ctx.pool.query('SELECT role FROM users WHERE id = $1', [alice.user.id]);
    assert.equal(rows[0].role, 'user');
  });

  it('an admin sees platform-wide scans with owners, unlike a normal user', async () => {
    const res = await request(ctx.app).get('/api/admin/scans').set(bearer(admin.accessToken));
    assert.equal(res.body.pagination.total, 2);
    assert.deepEqual(new Set(res.body.data.map((s) => s.user.name)), new Set(['Alice', 'Bob']));
  });

  it('demoting an admin takes effect immediately for already-issued tokens', async () => {
    const other = await registerAdmin(ctx.app, ctx.pool);
    assert.equal((await request(ctx.app).get('/api/admin/users').set(bearer(other.accessToken))).status, 200);
    await ctx.pool.query("UPDATE users SET role = 'user' WHERE id = $1", [other.user.id]);
    assert.equal((await request(ctx.app).get('/api/admin/users').set(bearer(other.accessToken))).status, 403);
  });
});
