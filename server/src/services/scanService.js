import { withTransaction } from '../db.js';
import { getScanDetail, insertScan } from '../repositories/scans.js';
import { AppError } from '../utils/errors.js';
import { InvalidUrlError, normalizeUrl } from '../utils/url.js';

/**
 * Scan workflow (steps match the project brief):
 *   validate + normalise (text only) -> ML service predicts -> store in PostgreSQL -> return the stored record.
 * The submitted URL is never visited or fetched at any point.
 */
export function createScanService({ pool, ml, models }) {
  return {
    async createScan(userId, rawUrl) {
      let normalized;
      try {
        normalized = normalizeUrl(rawUrl);
      } catch (err) {
        if (err instanceof InvalidUrlError) throw new AppError(400, 'INVALID_URL', err.message);
        throw err;
      }

      // Nothing is stored unless the ML service produced a valid prediction.
      const p = await ml.predict(normalized.normalizedUrl);

      const scanId = await withTransaction(pool, (client) =>
        insertScan(client, userId, {
          submittedUrl: String(rawUrl).trim(),
          normalizedUrl: normalized.normalizedUrl,
          hostname: normalized.hostname,
          schemeAssumed: normalized.schemeAssumed,
          prediction: p.prediction,
          phishingProbability: p.phishing_probability,
          riskScore: p.risk_score,
          riskCategory: p.risk_category,
          modelName: p.model.name,
          modelVersion: p.model.version,
          features: p.features,
          contributions: p.contributions.map((c) => ({
            feature: c.feature,
            value: c.value,
            baseline: c.baseline,
            influence: c.influence,
          })),
          extractorVersion: p.model.extractor_version,
          riskFactors: p.risk_factors.map((f) => ({
            code: f.code,
            title: f.title,
            description: f.description,
            severity: f.severity,
            feature: f.feature ?? null,
            value: typeof f.value === 'number' ? f.value : null,
            modelInfluence: typeof f.model_influence === 'number' ? f.model_influence : null,
          })),
        }),
      );

      models.ensureRegistered(p.model.version); // fire and forget
      return getScanDetail(pool, userId, scanId);
    },
  };
}
