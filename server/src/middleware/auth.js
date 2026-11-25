import { asyncHandler, AppError, forbidden, isUuid, unauthorized } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

export const mapUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
});

/**
 * Verifies the bearer access token, then loads the user from PostgreSQL so that a disabled account or a changed role
 * takes effect immediately instead of lasting until the token expires.
 */
export function authenticate({ pool, config }) {
  return asyncHandler(async (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token, config);
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired');
      throw unauthorized('Invalid access token');
    }
    if (!isUuid(payload.sub)) throw unauthorized('Invalid access token');

    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, created_at, last_login_at FROM users WHERE id = $1',
      [payload.sub],
    );
    const row = rows[0];
    if (!row) throw unauthorized('Invalid access token');
    if (!row.is_active) throw forbidden('This account has been disabled');
    req.user = mapUser(row);
    next();
  });
}

/** Role-based access control: only the named role passes. Must run after `authenticate`. */
export const requireRole = (role) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== role) return next(forbidden());
  return next();
};
