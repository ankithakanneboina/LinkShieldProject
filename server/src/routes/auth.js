import bcrypt from 'bcrypt';
import { Router } from 'express';
import { REFRESH_COOKIE } from '../constants.js';
import { UNIQUE_VIOLATION, withTransaction } from '../db.js';
import { authenticate, mapUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { hashToken, newRefreshToken, signAccessToken } from '../utils/tokens.js';
import { changePasswordBody, loginBody, refreshBody, registerBody, updateProfileBody } from '../validators/schemas.js';

/** A refresh token revoked this recently is treated as a harmless race (two tabs), not as theft. */
const REUSE_GRACE_MS = 10_000;
const DAY_MS = 86_400_000;

export function authRoutes({ pool, config, limiters }) {
  const router = Router();
  const requireAuth = authenticate({ pool, config });

  // Used when the email is unknown so the response time does not reveal whether an account exists.
  const dummyHash = bcrypt.hashSync('linkshield-timing-equaliser', config.bcryptRounds);

  const cookieBase = { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/api/auth' };
  const setRefreshCookie = (res, token) => res.cookie(REFRESH_COOKIE, token, { ...cookieBase, maxAge: config.refreshTtlDays * DAY_MS });
  const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, cookieBase);
  const presentedToken = (req) => req.cookies?.[REFRESH_COOKIE] || req.valid?.body?.refreshToken || null;

  async function startSession(db, req, res, userRow) {
    const refreshToken = newRefreshToken();
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
      [userRow.id, hashToken(refreshToken), String(config.refreshTtlDays), (req.get('user-agent') || '').slice(0, 255) || null, req.ip || null],
    );
    setRefreshCookie(res, refreshToken);
    const user = mapUser(userRow);
    return { user, accessToken: signAccessToken(user, config), expiresIn: config.accessTtlSeconds };
  }

  router.post(
    '/register',
    limiters.auth,
    validate({ body: registerBody }),
    asyncHandler(async (req, res) => {
      const { name, email, password } = req.valid.body;
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      let row;
      try {
        // The role is NEVER taken from the request: self-registration always creates a normal user.
        ({ rows: [row] } = await pool.query(
          `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user')
           RETURNING id, name, email, role, created_at, last_login_at`,
          [name, email, passwordHash],
        ));
      } catch (err) {
        if (err.code === UNIQUE_VIOLATION) {
          throw new AppError(409, 'CONFLICT', 'An account with this email already exists.', [
            { field: 'email', message: 'This email is already registered.' },
          ]);
        }
        throw err;
      }
      res.status(201).json(await startSession(pool, req, res, row));
    }),
  );

  router.post(
    '/login',
    limiters.auth,
    validate({ body: loginBody }),
    asyncHandler(async (req, res) => {
      const { email, password } = req.valid.body;
      const { rows } = await pool.query(
        `SELECT id, name, email, password_hash, role, is_active, created_at, last_login_at
           FROM users WHERE lower(email) = lower($1)`,
        [email],
      );
      const row = rows[0];
      const tooLong = Buffer.byteLength(password, 'utf8') > 72; // bcrypt would silently truncate
      const matches = await bcrypt.compare(password, row ? row.password_hash : dummyHash);
      if (!row || !matches || tooLong) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
      if (!row.is_active) throw new AppError(403, 'FORBIDDEN', 'This account has been disabled.');

      const { rows: [updated] } = await pool.query(
        `UPDATE users SET last_login_at = now() WHERE id = $1
         RETURNING id, name, email, role, created_at, last_login_at`,
        [row.id],
      );
      const session = await startSession(pool, req, res, updated);
      pool.query("DELETE FROM refresh_tokens WHERE expires_at < now() - interval '30 days'").catch(() => {});
      res.json(session);
    }),
  );

  router.post(
    '/refresh',
    validate({ body: refreshBody }),
    asyncHandler(async (req, res) => {
      const token = presentedToken(req);
      if (!token) {
        clearRefreshCookie(res);
        throw new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please log in again.');
      }

      const outcome = await withTransaction(pool, async (c) => {
        const { rows } = await c.query(
          `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
                  u.name, u.email, u.role, u.is_active, u.created_at, u.last_login_at
             FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
            WHERE rt.token_hash = $1
              FOR UPDATE OF rt`,
          [hashToken(token)],
        );
        const row = rows[0];
        if (!row) return { ok: false };

        if (row.revoked_at) {
          // Presenting an already-rotated token later means it was copied: revoke every session of this user.
          if (Date.now() - new Date(row.revoked_at).getTime() > REUSE_GRACE_MS) {
            await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
          }
          return { ok: false };
        }
        if (new Date(row.expires_at) <= new Date() || !row.is_active) return { ok: false };

        await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
        const next = newRefreshToken();
        await c.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
           VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
          [row.user_id, hashToken(next), String(config.refreshTtlDays), (req.get('user-agent') || '').slice(0, 255) || null, req.ip || null],
        );
        return { ok: true, user: mapUser({ ...row, id: row.user_id }), next };
      });

      if (!outcome.ok) {
        clearRefreshCookie(res);
        throw new AppError(401, 'UNAUTHORIZED', 'Your session has expired. Please log in again.');
      }
      setRefreshCookie(res, outcome.next);
      res.json({ user: outcome.user, accessToken: signAccessToken(outcome.user, config), expiresIn: config.accessTtlSeconds });
    }),
  );

  router.post(
    '/logout',
    validate({ body: refreshBody }),
    asyncHandler(async (req, res) => {
      const token = presentedToken(req);
      if (token) {
        await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)]);
      }
      clearRefreshCookie(res);
      res.status(204).end();
    }),
  );

  const loadProfile = async (userId) => {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login_at,
              (SELECT count(*) FROM scan_history s WHERE s.user_id = u.id)::int AS scan_count
         FROM users u WHERE u.id = $1`,
      [userId],
    );
    return { ...mapUser(rows[0]), scanCount: rows[0].scan_count };
  };

  router.get('/profile', requireAuth, asyncHandler(async (req, res) => res.json({ user: await loadProfile(req.user.id) })));

  router.patch(
    '/profile',
    requireAuth,
    validate({ body: updateProfileBody }),
    asyncHandler(async (req, res) => {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [req.valid.body.name, req.user.id]);
      res.json({ user: await loadProfile(req.user.id) });
    }),
  );

  router.post(
    '/change-password',
    limiters.auth,
    requireAuth,
    validate({ body: changePasswordBody }),
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.valid.body;
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const ok = Buffer.byteLength(currentPassword, 'utf8') <= 72 && (await bcrypt.compare(currentPassword, rows[0].password_hash));
      if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Your current password is not correct.');

      const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
      await withTransaction(pool, async (c) => {
        await c.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
        await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.id]);
      });
      clearRefreshCookie(res);
      res.status(204).end();
    }),
  );

  return router;
}
