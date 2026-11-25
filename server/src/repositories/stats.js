/**
 * Aggregate queries behind the dashboards. Every number the UI shows is computed here from PostgreSQL.
 *
 * Conventions
 *  - `userId` null  => platform-wide (admin); a uuid => only that user's scans.
 *  - Days and weeks are UTC calendar days / ISO weeks (Monday start). Series are zero-filled so charts have no gaps.
 */

const WINDOW = `(((now() AT TIME ZONE 'UTC')::date - ($2::int - 1))::timestamp AT TIME ZONE 'UTC')`;

/** WHERE fragment for scan_history rows; $1 = user id (or null), $2 = number of days (or null for all time). */
const scope = (alias = '') => {
  const p = alias ? `${alias}.` : '';
  return `($1::uuid IS NULL OR ${p}user_id = $1::uuid) AND ($2::int IS NULL OR ${p}scanned_at >= ${WINDOW})`;
};

export async function totals(db, userId, days = null) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS "totalScans",
            (count(*) FILTER (WHERE prediction = 'phishing'))::int AS "phishingCount",
            (count(*) FILTER (WHERE prediction = 'legitimate'))::int AS "legitimateCount",
            (count(*) FILTER (WHERE risk_category = 'high'))::int AS "highRiskCount",
            COALESCE(round(avg(risk_score)::numeric, 1), 0)::float8 AS "averageRiskScore"
       FROM scan_history
      WHERE ${scope()}`,
    [userId, days],
  );
  return rows[0];
}

export async function riskDistribution(db, userId, days = null) {
  const { rows } = await db.query(
    `SELECT c.category, count(s.id)::int AS count
       FROM (VALUES ('low', 1), ('medium', 2), ('high', 3)) AS c(category, ord)
       LEFT JOIN scan_history s ON s.risk_category = c.category AND ${scope('s')}
      GROUP BY c.category, c.ord
      ORDER BY c.ord`,
    [userId, days],
  );
  return rows;
}

export async function riskScoreBuckets(db, userId, days = null) {
  const { rows } = await db.query(
    `SELECT (b * 10)::text || '-' || (CASE WHEN b = 9 THEN 100 ELSE b * 10 + 9 END)::text AS bucket,
            count(s.id)::int AS count
       FROM generate_series(0, 9) AS b
       LEFT JOIN scan_history s ON LEAST(s.risk_score / 10, 9) = b AND ${scope('s')}
      GROUP BY b
      ORDER BY b`,
    [userId, days],
  );
  return rows;
}

export async function topDomains(db, userId, days = null, limit = 5) {
  const { rows } = await db.query(
    `SELECT hostname,
            count(*)::int AS count,
            (count(*) FILTER (WHERE prediction = 'phishing'))::int AS "phishingCount"
       FROM scan_history
      WHERE ${scope()}
      GROUP BY hostname
      ORDER BY 2 DESC, 1
      LIMIT ${Number(limit)}`,
    [userId, days],
  );
  return rows;
}

export async function topRiskFactors(db, userId, days = null, limit = 5) {
  const { rows } = await db.query(
    `SELECT rf.code, max(rf.title) AS title, count(*)::int AS count
       FROM risk_factors rf
       JOIN scan_history s ON s.id = rf.scan_id
      WHERE ${scope('s')}
      GROUP BY rf.code
      ORDER BY 3 DESC, 1
      LIMIT ${Number(limit)}`,
    [userId, days],
  );
  return rows;
}

/** One row per UTC day for the last `days` days (today included), zero-filled. */
export async function dailySeries(db, userId, days) {
  const { rows } = await db.query(
    `WITH day_list AS (
       SELECT d::date AS day
         FROM generate_series(
                ((now() AT TIME ZONE 'UTC')::date - ($2::int - 1))::timestamp,
                (now() AT TIME ZONE 'UTC')::date::timestamp,
                interval '1 day') AS d
     ), agg AS (
       SELECT (scanned_at AT TIME ZONE 'UTC')::date AS day,
              count(*)::int AS total,
              (count(*) FILTER (WHERE prediction = 'phishing'))::int AS phishing,
              (count(*) FILTER (WHERE prediction = 'legitimate'))::int AS legitimate
         FROM scan_history
        WHERE ${scope()}
        GROUP BY 1
     )
     SELECT to_char(day_list.day, 'YYYY-MM-DD') AS date,
            COALESCE(agg.total, 0) AS total,
            COALESCE(agg.phishing, 0) AS phishing,
            COALESCE(agg.legitimate, 0) AS legitimate
       FROM day_list
       LEFT JOIN agg ON agg.day = day_list.day
      ORDER BY day_list.day`,
    [userId, days],
  );
  return rows;
}

/** One row per ISO week (Monday start) for the last `weeks` weeks including the current one, zero-filled. */
export async function weeklySeries(db, userId, weeks) {
  const { rows } = await db.query(
    `WITH week_list AS (
       SELECT w::date AS week
         FROM generate_series(
                (date_trunc('week', now() AT TIME ZONE 'UTC')::date - 7 * ($2::int - 1))::timestamp,
                date_trunc('week', now() AT TIME ZONE 'UTC'),
                interval '7 days') AS w
     ), agg AS (
       SELECT date_trunc('week', scanned_at AT TIME ZONE 'UTC')::date AS week,
              count(*)::int AS total,
              (count(*) FILTER (WHERE prediction = 'phishing'))::int AS phishing,
              (count(*) FILTER (WHERE prediction = 'legitimate'))::int AS legitimate
         FROM scan_history
        WHERE ($1::uuid IS NULL OR user_id = $1::uuid)
          AND scanned_at >= ((date_trunc('week', now() AT TIME ZONE 'UTC')::date - 7 * ($2::int - 1))::timestamp AT TIME ZONE 'UTC')
        GROUP BY 1
     )
     SELECT to_char(week_list.week, 'YYYY-MM-DD') AS "weekStart",
            COALESCE(agg.total, 0) AS total,
            COALESCE(agg.phishing, 0) AS phishing,
            COALESCE(agg.legitimate, 0) AS legitimate
       FROM week_list
       LEFT JOIN agg ON agg.week = week_list.week
      ORDER BY week_list.week`,
    [userId, weeks],
  );
  return rows;
}

const asCount = (rows, key, value) => rows.find((r) => r[key] === value)?.count ?? 0;

// -------------------------------------------------------------------------------------------------
// Composed responses (shapes documented in docs/API.md)
// -------------------------------------------------------------------------------------------------

export async function userDashboard(db, userId, { recentScans }) {
  const [t, daily, weekly, risk] = await Promise.all([
    totals(db, userId),
    dailySeries(db, userId, 14),
    weeklySeries(db, userId, 8),
    riskDistribution(db, userId),
  ]);
  const { averageRiskScore: _unused, ...counts } = t;
  return { totals: counts, recentScans, dailyActivity: daily, weeklyTrend: weekly, riskDistribution: risk };
}

export async function userAnalytics(db, userId, range) {
  const weeks = Math.ceil(range / 7) + 1;
  const [t, daily, weekly, risk, buckets, domains, factors] = await Promise.all([
    totals(db, userId, range),
    dailySeries(db, userId, range),
    weeklySeries(db, userId, weeks),
    riskDistribution(db, userId, range),
    riskScoreBuckets(db, userId, range),
    topDomains(db, userId, range),
    topRiskFactors(db, userId, range),
  ]);
  return {
    range,
    totals: t,
    dailySeries: daily,
    weeklyTrend: weekly,
    riskDistribution: risk,
    predictionSplit: [
      { prediction: 'phishing', count: t.phishingCount },
      { prediction: 'legitimate', count: t.legitimateCount },
    ],
    riskScoreBuckets: buckets,
    topDomains: domains,
    topRiskFactors: factors,
  };
}

export async function adminAnalytics(db, range) {
  const [platform, daily, risk, growth, feedback] = await Promise.all([
    db.query(
      `SELECT (SELECT count(*) FROM users)::int AS "totalUsers",
              (SELECT count(*) FROM scan_history)::int AS "totalScans",
              (SELECT count(*) FROM scan_history WHERE prediction = 'phishing')::int AS "phishingCount",
              (SELECT count(*) FROM scan_history WHERE prediction = 'legitimate')::int AS "legitimateCount",
              (SELECT count(*) FROM scan_history WHERE risk_category = 'high')::int AS "highRiskCount",
              (SELECT count(*) FROM user_feedback)::int AS "totalFeedback",
              (SELECT count(*) FROM users WHERE created_at >= now() - interval '7 days')::int AS "newUsersLast7Days",
              (SELECT count(*) FROM scan_history WHERE scanned_at >= now() - interval '24 hours')::int AS "scansLast24h"`,
    ),
    dailySeries(db, null, range),
    riskDistribution(db, null, range),
    db.query(
      `WITH day_list AS (
         SELECT d::date AS day
           FROM generate_series(
                  ((now() AT TIME ZONE 'UTC')::date - ($1::int - 1))::timestamp,
                  (now() AT TIME ZONE 'UTC')::date::timestamp,
                  interval '1 day') AS d
       ), agg AS (
         SELECT (created_at AT TIME ZONE 'UTC')::date AS day, count(*)::int AS n
           FROM users
          WHERE created_at >= (((now() AT TIME ZONE 'UTC')::date - ($1::int - 1))::timestamp AT TIME ZONE 'UTC')
          GROUP BY 1
       )
       SELECT to_char(day_list.day, 'YYYY-MM-DD') AS date, COALESCE(agg.n, 0) AS "newUsers"
         FROM day_list LEFT JOIN agg ON agg.day = day_list.day
        ORDER BY day_list.day`,
      [range],
    ),
    db.query(
      `SELECT c.category, count(f.id)::int AS count
         FROM (VALUES ('correct', 1), ('false_positive', 2), ('false_negative', 3), ('unclear_explanation', 4), ('other', 5)) AS c(category, ord)
         LEFT JOIN user_feedback f ON f.category = c.category
        GROUP BY c.category, c.ord
        ORDER BY c.ord`,
    ),
  ]);
  return {
    range,
    totals: platform.rows[0],
    dailySeries: daily,
    userGrowth: growth.rows,
    riskDistribution: risk,
    feedbackByCategory: feedback.rows,
  };
}

/** Newest platform events, assembled from real scan, registration and feedback rows. */
export async function recentActivity(db, limit) {
  const { rows } = await db.query(
    `SELECT type, at, name, email, summary, ref_id
       FROM (
         (SELECT 'scan'::text AS type, s.scanned_at AS at, u.name, u.email,
                 format('Scanned %s: %s, risk score %s', s.hostname, s.prediction, s.risk_score) AS summary, s.id AS ref_id
            FROM scan_history s JOIN users u ON u.id = s.user_id
           ORDER BY s.scanned_at DESC LIMIT $1)
         UNION ALL
         (SELECT 'registration'::text, u.created_at, u.name, u.email, 'Created an account', u.id
            FROM users u ORDER BY u.created_at DESC LIMIT $1)
         UNION ALL
         (SELECT 'feedback'::text, f.created_at, u.name, u.email, format('Left feedback (%s)', f.category), f.id
            FROM user_feedback f JOIN users u ON u.id = f.user_id
           ORDER BY f.created_at DESC LIMIT $1)
       ) events
      ORDER BY at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    type: r.type,
    at: r.at,
    actor: { name: r.name, email: r.email },
    summary: r.summary,
    refId: r.ref_id,
  }));
}

export { asCount };
