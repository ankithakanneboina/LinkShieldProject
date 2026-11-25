import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}

const pool = createPool(config);
const app = createApp({ config, pool });

const server = app.listen(config.port, () => {
  console.log(`[server] LinkShield API listening on :${config.port} (${config.nodeEnv}); ML service at ${config.mlServiceUrl}`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
