import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { feedbackBody } from '../validators/schemas.js';

/**
 * POST /api/feedback. Feedback is stored as unverified user opinion. Nothing in the codebase reads it to
 * relabel data or retrain the model.
 */
export function feedbackRoutes({ pool, config }) {
  const router = Router();

  router.post(
    '/feedback',
    authenticate({ pool, config }),
    validate({ body: feedbackBody }),
    asyncHandler(async (req, res) => {
      const { scanId, category, comments } = req.valid.body;

      const owned = await pool.query('SELECT 1 FROM scan_history WHERE id = $1 AND user_id = $2', [scanId, req.user.id]);
      if (owned.rowCount === 0) throw notFound('Scan not found');

      // One entry per user per scan: submitting again updates it. `xmax = 0` is true only for a fresh insert.
      const { rows } = await pool.query(
        `INSERT INTO user_feedback (scan_id, user_id, category, comments)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (scan_id, user_id) DO UPDATE
           SET category = EXCLUDED.category, comments = EXCLUDED.comments, updated_at = now()
         RETURNING id, scan_id, category, comments, created_at, updated_at, (xmax = 0) AS inserted`,
        [scanId, req.user.id, category, comments ?? null],
      );
      const r = rows[0];
      res.status(r.inserted ? 201 : 200).json({
        feedback: {
          id: r.id,
          scanId: r.scan_id,
          category: r.category,
          comments: r.comments,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
      });
    }),
  );

  return router;
}
