import { isUuid } from '../utils/errors.js';

export const mapScanSummary = (r) => ({
  id: r.id,
  submittedUrl: r.submitted_url,
  normalizedUrl: r.normalized_url,
  hostname: r.hostname,
  schemeAssumed: r.scheme_assumed,
  prediction: r.prediction,
  phishingProbability: r.phishing_probability,
  riskScore: r.risk_score,
  riskCategory: r.risk_category,
  modelName: r.model_name,
  modelVersion: r.model_version,
  scannedAt: r.scanned_at,
});

const SUMMARY_COLUMNS = `s.id, s.submitted_url, s.normalized_url, s.hostname, s.scheme_assumed, s.prediction,
  s.phishing_probability, s.risk_score, s.risk_category, s.model_name, s.model_version, s.scanned_at`;

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

export const paginate = ({ page, limit }, total) => ({ page, limit, total, totalPages: Math.ceil(total / limit) });

/**
 * Builds a parameterised WHERE clause. Values only ever travel as bind parameters;
 * the only interpolated SQL is fixed text chosen by this code (never user input).
 */
function buildWhere({ userId, search, prediction, risk }) {
  const clauses = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    clauses.push(sql.replace('?', `$${params.length}`));
  };
  if (userId) add('s.user_id = ?', userId);
  if (search) add("s.normalized_url ILIKE ? ESCAPE '\\'", `%${escapeLike(search)}%`);
  if (prediction) add('s.prediction = ?', prediction);
  if (risk) add('s.risk_category = ?', risk);
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

/** Lists scans. With `userId` only that user's scans are visible; `includeUser` is for the admin view. */
export async function listScans(db, { userId, search, prediction, risk, sort = 'newest', page, limit, includeUser = false }) {
  const { where, params } = buildWhere({ userId, search, prediction, risk });
  const direction = sort === 'oldest' ? 'ASC' : 'DESC'; // from a validated enum, never raw input

  const count = await db.query(`SELECT count(*)::int AS total FROM scan_history s ${where}`, params);
  const total = count.rows[0].total;

  const userColumns = includeUser ? ', u.id AS user_id, u.name AS user_name, u.email AS user_email' : '';
  const userJoin = includeUser ? 'JOIN users u ON u.id = s.user_id' : '';
  const { rows } = await db.query(
    `SELECT ${SUMMARY_COLUMNS}${userColumns}
       FROM scan_history s ${userJoin}
       ${where}
      ORDER BY s.scanned_at ${direction}, s.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );
  const data = rows.map((r) =>
    includeUser ? { ...mapScanSummary(r), user: { id: r.user_id, name: r.user_name, email: r.user_email } } : mapScanSummary(r),
  );
  return { data, pagination: paginate({ page, limit }, total) };
}

export async function recentScans(db, userId, limit = 5) {
  const { rows } = await db.query(
    `SELECT ${SUMMARY_COLUMNS} FROM scan_history s WHERE s.user_id = $1 ORDER BY s.scanned_at DESC, s.id LIMIT $2`,
    [userId, limit],
  );
  return rows.map(mapScanSummary);
}

/** Inserts the scan plus its feature and risk-factor rows. Pass a transaction client. */
export async function insertScan(client, userId, scan) {
  const { rows } = await client.query(
    `INSERT INTO scan_history
       (user_id, submitted_url, normalized_url, hostname, scheme_assumed, prediction,
        phishing_probability, risk_score, risk_category, model_name, model_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      userId, scan.submittedUrl, scan.normalizedUrl, scan.hostname, scan.schemeAssumed, scan.prediction,
      scan.phishingProbability, scan.riskScore, scan.riskCategory, scan.modelName, scan.modelVersion,
    ],
  );
  const scanId = rows[0].id;

  await client.query(
    'INSERT INTO url_features (scan_id, features, contributions, extractor_version) VALUES ($1, $2::jsonb, $3::jsonb, $4)',
    [scanId, JSON.stringify(scan.features), JSON.stringify(scan.contributions), scan.extractorVersion],
  );

  if (scan.riskFactors.length) {
    const values = [];
    const params = [scanId];
    scan.riskFactors.forEach((f, i) => {
      const base = params.length;
      params.push(i, f.code, f.title, f.description, f.severity, f.feature ?? null, f.value ?? null, f.modelInfluence ?? null);
      values.push(`($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`);
    });
    await client.query(
      `INSERT INTO risk_factors (scan_id, position, code, title, description, severity, feature_name, feature_value, model_influence)
       VALUES ${values.join(', ')}`,
      params,
    );
  }
  return scanId;
}

/** Full scan detail, but ONLY if it belongs to `userId`. Returns null for unknown ids and other users' scans alike. */
export async function getScanDetail(db, userId, scanId) {
  if (!isUuid(scanId)) return null;
  const { rows } = await db.query(
    `SELECT ${SUMMARY_COLUMNS}, f.features, f.contributions, f.extractor_version
       FROM scan_history s
       LEFT JOIN url_features f ON f.scan_id = s.id
      WHERE s.id = $1 AND s.user_id = $2`,
    [scanId, userId],
  );
  const row = rows[0];
  if (!row) return null;

  const [factors, feedback] = await Promise.all([
    db.query(
      `SELECT code, title, description, severity, feature_name, feature_value, model_influence
         FROM risk_factors WHERE scan_id = $1 ORDER BY position`,
      [scanId],
    ),
    db.query(
      'SELECT id, category, comments, created_at, updated_at FROM user_feedback WHERE scan_id = $1 AND user_id = $2',
      [scanId, userId],
    ),
  ]);

  return {
    ...mapScanSummary(row),
    extractorVersion: row.extractor_version,
    features: row.features ?? {},
    riskFactors: factors.rows.map((f) => ({
      code: f.code,
      title: f.title,
      description: f.description,
      severity: f.severity,
      feature: f.feature_name,
      value: f.feature_value,
      modelInfluence: f.model_influence,
    })),
    contributions: row.contributions ?? [],
    feedback: feedback.rows[0] ? mapFeedback(feedback.rows[0]) : null,
  };
}

export const mapFeedback = (r) => ({
  id: r.id,
  category: r.category,
  comments: r.comments,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Deletes a scan owned by `userId`. Child rows (features, risk factors, feedback) are removed by ON DELETE CASCADE. */
export async function deleteScan(db, userId, scanId) {
  if (!isUuid(scanId)) return false;
  const { rowCount } = await db.query('DELETE FROM scan_history WHERE id = $1 AND user_id = $2', [scanId, userId]);
  return rowCount > 0;
}
