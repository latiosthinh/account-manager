import crypto from 'node:crypto';

// ponytail: basic process.env reader; add dotenv or file loader when external file parsing needed
const devFallbackSecret = crypto.randomBytes(32).toString('hex');

export const config = {
  get adminPassword() {
    return process.env.ADMIN_PASSWORD || 'admin';
  },
  get pinCode() {
    return process.env.PIN_CODE || process.env.PIN || '';
  },
  get sessionSecret() {
    return process.env.SESSION_SECRET || devFallbackSecret;
  },
  get port() {
    return Number.parseInt(process.env.PORT || '3000', 10);
  },
  get host() {
    return process.env.HOST || '0.0.0.0';
  },
  get cookieName() {
    return process.env.COOKIE_NAME || 'account_manager_session';
  },
  maxFailedLogins: 5,
  lockoutWindowMs: 15 * 60 * 1000,
  get dbUrl() {
    return process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
  },
  get dbAuthToken() {
    return process.env.TURSO_AUTH_TOKEN || '';
  },
  get dbPath() {
    return process.env.DB_PATH || (process.env.VERCEL ? '/tmp/account-manager.sqlite' : 'data/account-manager.sqlite');
  },
};
