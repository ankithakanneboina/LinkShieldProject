import { paginate } from './scans.js';

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

export async function listUsers(db, { search, page, limit }) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${escapeLike(search)}%`);
    where = "WHERE (u.name ILIKE $1 ESCAPE '\\' OR u.email ILIKE $1 ESCAPE '\\')";
  }
  const total = (await db.query(`SELECT count(*)::int AS total FROM users u ${where}`, params)).rows[0].total;
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login_at,
            (SELECT count(*) FROM scan_history s WHERE s.user_id = u.id)::int AS scan_count
       FROM users u
       ${where}
      ORDER BY u.created_at DESC, u.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );
  return {
    data: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.is_active,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at,
      scanCount: r.scan_count,
    })),
    pagination: paginate({ page, limit }, total),
  };
}

export async function listFeedback(db, { category, page, limit }) {
  const params = [];
  let where = '';
  if (category) {
    params.push(category);
    where = 'WHERE f.category = $1';
  }
  const total = (await db.query(`SELECT count(*)::int AS total FROM user_feedback f ${where}`, params)).rows[0].total;
  const { rows } = await db.query(
    `SELECT f.id, f.category, f.comments, f.created_at, f.updated_at,
            u.id AS user_id, u.name AS user_name, u.email AS user_email,
            s.id AS scan_id, s.normalized_url, s.prediction, s.risk_score, s.risk_category
       FROM user_feedback f
       JOIN users u ON u.id = f.user_id
       JOIN scan_history s ON s.id = f.scan_id
       ${where}
      ORDER BY f.created_at DESC, f.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit],
  );
  return {
    data: rows.map((r) => ({
      id: r.id,
      category: r.category,
      comments: r.comments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      user: { id: r.user_id, name: r.user_name, email: r.user_email },
      scan: { id: r.scan_id, normalizedUrl: r.normalized_url, prediction: r.prediction, riskScore: r.risk_score, riskCategory: r.risk_category },
    })),
    pagination: paginate({ page, limit }, total),
  };
}
