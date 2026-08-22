import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env automatically if present
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // ignore parse error if already loaded
  }
}

import { config } from './config.js';
import { initDb, closeDb } from './db.js';
import { authRouter } from './routes/auth-routes.js';
import { categoryRouter } from './routes/category-routes.js';
import { accountRouter } from './routes/account-routes.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(express.static('public'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/accounts', accountRouter);

  return app;
}

export const app = createApp();
export default app;

export function startServer(port = config.port, host = config.host, customApp = app) {
  // Initialize database
  initDb();

  // 404 for unmatched /api routes
  customApp.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Global error handler
  // ponytail: basic json error handler; upgrade with structured logger (pino) if metrics/tracing needed
  customApp.use((err, _req, res, _next) => {
    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal Server Error'
      : (err.message || 'Internal Server Error');
    res.status(status).json({ error: message });
  });

  return new Promise((resolve) => {
    const server = customApp.listen(port, host, () => {
      console.log(`Server listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  startServer(config.port, config.host);

  const handleShutdown = () => {
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}
