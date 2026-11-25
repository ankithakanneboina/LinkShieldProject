import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

/** Short-lived JWT access token. The user id is the `sub` claim; role is re-read from the DB on every request. */
export function signAccessToken(user, config) {
  return jwt.sign({ role: user.role }, config.jwtAccessSecret, {
    algorithm: 'HS256',
    subject: user.id,
    expiresIn: config.accessTtlSeconds,
  });
}

export function verifyAccessToken(token, config) {
  return jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
}

/** Opaque, high-entropy refresh token. Only its SHA-256 hash is stored in the database. */
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
