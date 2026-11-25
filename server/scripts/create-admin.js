#!/usr/bin/env node
/**
 * Creates (or promotes) an administrator. Self-registration can never create admins, and no default admin exists.
 * The password is read from the environment, never from a command-line argument (which shells keep in history).
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a-long-password-1' npm run create-admin
 *
 * If the email already exists, that account is promoted to admin and its password is left unchanged.
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { registerBody } from '../src/validators/schemas.js';

const { DATABASE_URL, ADMIN_EMAIL, ADMIN_NAME = 'Administrator', ADMIN_PASSWORD } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME).');
  process.exit(1);
}

const parsed = registerBody.safeParse({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
if (!parsed.success) {
  console.error('Invalid admin details:\n' + parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}
const { name, email, password } = parsed.data;

const pool = new pg.Pool({ connectionString: DATABASE_URL });
try {
  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rowCount) {
    await pool.query("UPDATE users SET role = 'admin', is_active = true WHERE id = $1", [existing.rows[0].id]);
    console.log(`Existing account ${email} is now an admin (password unchanged).`);
  } else {
    const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS) || 12);
    await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')", [name, email, hash]);
    console.log(`Admin account created for ${email}.`);
  }
}  catch (err) {
  console.error('FAILED ERROR DETAILS:');
  console.error(err);
  console.error('ERROR MESSAGE:', err?.message);
  console.error('ERROR STACK:', err?.stack);
  process.exitCode = 1;
} finally {
  await pool.end();
}
