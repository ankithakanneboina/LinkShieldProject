#!/usr/bin/env node
/**
 * Repeatable database initialisation: applies every migrations/*.sql file once, in filename order, each inside a
 * transaction, and records it in `schema_migrations`. Safe to run any number of times.
 *
 *   npm run migrate
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations');

/** @param {pg.Pool | pg.Client} db */
export async function migrate(db, { dir = MIGRATIONS_DIR, log = console.log } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const done = new Set((await db.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename));
  const files = fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
  const applied = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log(`applied ${file}`);
      applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
  if (!applied.length) log('database is up to date');
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (copy .env.example to .env and edit it)');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  migrate(pool)
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
