import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getScanDetail } from '../repositories/scans.js';
import { buildScanReport } from '../services/reportService.js';
import { asyncHandler, notFound } from '../utils/errors.js';

export function reportRoutes({ pool, config }) {
  const router = Router();

  // GET /api/reports/:id/pdf — rendered from the stored scan row, only for its owner.
  router.get(
    '/reports/:id/pdf',
    authenticate({ pool, config }),
    asyncHandler(async (req, res) => {
      const scan = await getScanDetail(pool, req.user.id, req.params.id);
      if (!scan) throw notFound('Scan not found');
      const pdf = await buildScanReport(scan);
      res
        .status(200)
        .set({
          'Content-Type': 'application/pdf',
          'Content-Length': String(pdf.length),
          'Content-Disposition': `attachment; filename="linkshield-report-${scan.id.slice(0, 8)}.pdf"`,
          'Cache-Control': 'private, no-store',
        })
        .send(pdf);
    }),
  );

  return router;
}
