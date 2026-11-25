import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { recentScans } from '../repositories/scans.js';
import * as stats from '../repositories/stats.js';
import { asyncHandler } from '../utils/errors.js';
import { rangeQuery } from '../validators/schemas.js';

/** GET /api/dashboard and GET /api/analytics: aggregates over the signed-in user's own scans only. */
export function insightRoutes({ pool, config }) {
  const router = Router();
  router.use(authenticate({ pool, config }));

  router.get(
    '/dashboard',
    asyncHandler(async (req, res) => {
      const recent = await recentScans(pool, req.user.id, 5);
      res.json(await stats.userDashboard(pool, req.user.id, { recentScans: recent }));
    }),
  );

  router.get(
    '/analytics',
    validate({ query: rangeQuery }),
    asyncHandler(async (req, res) => {
      res.json(await stats.userAnalytics(pool, req.user.id, req.valid.query.range));
    }),
  );

  return router;
}
