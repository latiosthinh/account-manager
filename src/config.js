import crypto from 'node:crypto';

// ponytail: basic process.env reader; add dotenv or file loader when external file parsing needed
const devFallbackSecret = crypto.randomBytes(32).toString('hex');

export const config = {
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  sessionSecret: process.env.SESSION_SECRET || devFallbackSecret,
  port: Number.parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  cookieName: process.env.COOKIE_NAME || 'account_manager_session',
  maxFailedLogins: 5,
  lockoutWindowMs: 15 * 60 * 1000,
  dbPath: process.env.DB_PATH || 'data/account-manager.sqlite',
};
