import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listFeedback, listUsers } from '../repositories/admin.js';
import { listScans } from '../repositories/scans.js';
import * as stats from '../repositories/stats.js';
import { asyncHandler } from '../utils/errors.js';
import { adminActivityQuery, adminFeedbackQuery, adminUsersQuery, listScansQuery, rangeQuery } from '../validators/schemas.js';

/**
 * Everything under /api/admin requires a valid token AND the admin role, enforced here on the server.
 * (The React UI also hides these pages from normal users, but that is only a convenience.)
 */
export function adminRoutes({ pool, config, models }) {
  const router = Router();
  router.use(authenticate({ pool, config }), requireRole('admin'));

  router.get('/users', validate({ query: adminUsersQuery }), asyncHandler(async (req, res) => res.json(await listUsers(pool, req.valid.query))));

  router.get(
    '/scans',
    validate({ query: listScansQuery }),
    asyncHandler(async (req, res) => res.json(await listScans(pool, { ...req.valid.query, includeUser: true }))),
  );

  router.get('/analytics', validate({ query: rangeQuery }), asyncHandler(async (req, res) => res.json(await stats.adminAnalytics(pool, req.valid.query.range))));

  router.get('/feedback', validate({ query: adminFeedbackQuery }), asyncHandler(async (req, res) => res.json(await listFeedback(pool, req.valid.query))));

  router.get('/model', asyncHandler(async (_req, res) => res.json(await models.getAdminModel())));

  router.get(
    '/activity',
    validate({ query: adminActivityQuery }),
    asyncHandler(async (req, res) => res.json({ data: await stats.recentActivity(pool, req.valid.query.limit) })),
  );

  return router;
}
