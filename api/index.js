import { app } from '../src/server.js';
import { initDb } from '../src/db.js';

// Initialize DB for serverless invocation (/tmp on Vercel)
initDb();

export default app;
