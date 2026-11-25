import rateLimit from 'express-rate-limit';
import { AppError } from '../utils/errors.js';

function limiter({ windowMs, limit, key, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(key ? { keyGenerator: key } : {}),
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
  });
}

const passthrough = (_req, _res, next) => next();

/** Builds the rate limiters from config. They become pass-through when RATE_LIMIT_DISABLED=true (tests only). */
export function createLimiters(config) {
  const { disabled, globalPerMinute, authPer15Min, scanPerMinute } = config.rateLimit;
  if (disabled) return { global: passthrough, auth: passthrough, scan: passthrough };
  return {
    global: limiter({ windowMs: 60_000, limit: globalPerMinute, message: 'Too many requests. Please slow down.' }),
    auth: limiter({ windowMs: 15 * 60_000, limit: authPer15Min, message: 'Too many attempts. Please wait a few minutes and try again.' }),
    // Per signed-in user (this runs after `authenticate`), so one user cannot exhaust the ML service for others.
    scan: limiter({ windowMs: 60_000, limit: scanPerMinute, key: (req) => `user:${req.user.id}`, message: 'You are scanning too quickly. Please wait a moment.' }),
  };
}
