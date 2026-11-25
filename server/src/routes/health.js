import { Router } from 'express';
import { asyncHandler } from '../utils/errors.js';

export function healthRoutes({ pool, ml }) {
  const router = Router();

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const [db, mlStatus] = await Promise.all([
        pool.query('SELECT 1').then(() => 'ok', () => 'unavailable'),
        ml.health(),
      ]);
      res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', database: db, mlService: mlStatus });
    }),
  );

  return router;
}
