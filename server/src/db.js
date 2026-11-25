import pg from 'pg';

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  });
  // An idle client erroring (e.g. the database restarting) must not crash the process.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  return pool;
}

/** Runs `fn(client)` inside BEGIN/COMMIT, rolling back on any error. */
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* the original error is the one that matters */
    }
    throw err;
  } finally {
    client.release();
  }
}

export const UNIQUE_VIOLATION = '23505';
