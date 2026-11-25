import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { deleteScan, getScanDetail, listScans } from '../repositories/scans.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { listScansQuery, scanBody } from '../validators/schemas.js';

/**
 * Every query below is scoped by `req.user.id`, which comes from the verified token, never from the request.
 * A scan that belongs to someone else is indistinguishable from one that does not exist (404).
 */
export function scanRoutes({ pool, config, limiters, scans }) {
  const router = Router();
  router.use(authenticate({ pool, config }));

  router.post(
    '/scan',
    limiters.scan,
    validate({ body: scanBody }),
    asyncHandler(async (req, res) => {
      const scan = await scans.createScan(req.user.id, req.valid.body.url);
      res.status(201).json({ scan });
    }),
  );

  router.get(
    '/scans',
    validate({ query: listScansQuery }),
    asyncHandler(async (req, res) => {
      res.json(await listScans(pool, { userId: req.user.id, ...req.valid.query }));
    }),
  );

  router.get(
    '/scans/:id',
    asyncHandler(async (req, res) => {
      const scan = await getScanDetail(pool, req.user.id, req.params.id);
      if (!scan) throw notFound('Scan not found');
      res.json({ scan });
    }),
  );

  router.delete(
    '/scans/:id',
    asyncHandler(async (req, res) => {
      if (!(await deleteScan(pool, req.user.id, req.params.id))) throw notFound('Scan not found');
      res.status(204).end();
    }),
  );

  return router;
}
