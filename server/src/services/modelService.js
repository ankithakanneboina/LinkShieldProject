import { withTransaction } from '../db.js';

const mapActive = (r) => ({
  modelName: r.model_name,
  modelVersion: r.model_version,
  algorithm: r.algorithm,
  trainedAt: r.trained_at,
  datasetName: r.dataset_name,
  datasetRecords: r.dataset_records,
  featureCount: r.feature_count,
  extractorVersion: r.extractor_version,
  metrics: r.metrics,
  riskThresholds: r.risk_thresholds,
  details: r.details,
});

/** Keeps the `model_information` table in step with what the ML service is really serving. */
export function createModelService({ pool, ml }) {
  const registered = new Set();

  /** Stores the ML service's /model-info payload and marks that version active (exactly one active version). */
  async function sync(info) {
    await withTransaction(pool, async (c) => {
      await c.query('UPDATE model_information SET is_active = false WHERE is_active AND model_version <> $1', [info.model_version]);
      await c.query(
        `INSERT INTO model_information
           (model_name, model_version, algorithm, trained_at, dataset_name, dataset_records, feature_count,
            extractor_version, metrics, risk_thresholds, details, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, true)
         ON CONFLICT (model_version) DO UPDATE SET
           model_name = EXCLUDED.model_name, algorithm = EXCLUDED.algorithm, trained_at = EXCLUDED.trained_at,
           dataset_name = EXCLUDED.dataset_name, dataset_records = EXCLUDED.dataset_records,
           feature_count = EXCLUDED.feature_count, extractor_version = EXCLUDED.extractor_version,
           metrics = EXCLUDED.metrics, risk_thresholds = EXCLUDED.risk_thresholds, details = EXCLUDED.details,
           is_active = true`,
        [
          info.model_name,
          info.model_version,
          info.algorithm ?? info.model_name,
          info.trained_at ?? null,
          info.dataset?.name ?? null,
          info.dataset?.records_used ?? null,
          info.feature_count ?? null,
          info.extractor_version ?? null,
          JSON.stringify(info.metrics ?? {}),
          JSON.stringify(info.risk_thresholds ?? {}),
          JSON.stringify(info),
        ],
      );
    });
  }

  return {
    sync,

    /** Called after a scan: registers a model version the first time it is seen. Best effort, never throws. */
    async ensureRegistered(version) {
      if (registered.has(version)) return;
      registered.add(version);
      try {
        const r = await ml.modelInfo();
        if (r.status === 'ok' && r.info.model_version === version) await sync(r.info);
        else registered.delete(version);
      } catch (err) {
        registered.delete(version);
        console.error('[model] could not register model version:', err.message);
      }
    },

    async getAdminModel() {
      const live = await ml.modelInfo();
      if (live.status === 'ok') await sync(live.info);

      const [active, history] = await Promise.all([
        pool.query('SELECT * FROM model_information WHERE is_active LIMIT 1'),
        pool.query(
          `SELECT model_version, model_name, trained_at, is_active
             FROM model_information ORDER BY trained_at DESC NULLS LAST, id DESC LIMIT 20`,
        ),
      ]);
      return {
        service: { status: live.status, checkedAt: new Date().toISOString() },
        active: active.rows[0] ? mapActive(active.rows[0]) : null,
        history: history.rows.map((h) => ({
          modelVersion: h.model_version,
          modelName: h.model_name,
          trainedAt: h.trained_at,
          isActive: h.is_active,
        })),
      };
    },
  };
}
