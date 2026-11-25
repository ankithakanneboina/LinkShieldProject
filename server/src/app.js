import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createLimiters } from './middleware/rateLimit.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { feedbackRoutes } from './routes/feedback.js';
import { healthRoutes } from './routes/health.js';
import { insightRoutes } from './routes/insights.js';
import { reportRoutes } from './routes/reports.js';
import { scanRoutes } from './routes/scans.js';
import { createMlClient } from './services/mlClient.js';
import { createModelService } from './services/modelService.js';
import { createScanService } from './services/scanService.js';

/**
 * Builds the Express app. `pool` and `ml` can be injected, which is how the tests run the real HTTP stack against a real
 * PostgreSQL database with a stand-in ML service.
 */
export function createApp({ config, pool, ml = createMlClient(config) }) {
  const app = express();
  const limiters = createLimiters(config);
  const models = createModelService({ pool, ml });
  const scans = createScanService({ pool, ml, models });
  const deps = { config, pool, ml, models, scans, limiters };

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Requests without an Origin header (curl, server-to-server, same-origin navigations) are not cross-site.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        const err = new Error('Origin not allowed');
        err.code = 'CORS_ORIGIN_DENIED';
        return cb(err);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '16kb' }));
  app.use(cookieParser());
  app.use('/api', limiters.global);

  app.use('/api', healthRoutes(deps));
  app.use('/api/auth', authRoutes(deps));
  app.use('/api', scanRoutes(deps));
  app.use('/api', insightRoutes(deps));
  app.use('/api', feedbackRoutes(deps));
  app.use('/api', reportRoutes(deps));
  app.use('/api/admin', adminRoutes(deps));
  app.use('/api', notFoundHandler);

  // Optional: serve the built React app from the same origin (single-container deployments).
  if (config.clientDir) {
    const dir = path.resolve(config.clientDir);
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      app.use(express.static(dir, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dir, 'index.html')));
    } else {
      console.warn(`[server] SERVE_CLIENT_DIR=${dir} has no index.html; not serving the client`);
    }
  }

  app.use(errorHandler);
  return app;
}
