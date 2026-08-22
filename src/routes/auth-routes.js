import { Router } from 'express';
import { config } from '../config.js';
import { verifyPassword, createSessionToken, verifySessionToken } from '../auth.js';
import { LoginRateLimiter } from '../rate-limiter.js';

export const authRouter = Router();
const limiter = new LoginRateLimiter(config.maxFailedLogins, config.lockoutWindowMs);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

authRouter.post('/login', (req, res) => {
  const ip = getClientIp(req);

  if (limiter.isRateLimited(ip)) {
    const retryAfter = limiter.getRetryAfterSeconds(ip);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many failed login attempts. Please try again later.',
      retryAfter,
    });
  }

  const { password } = req.body || {};
  const isValid = verifyPassword(password, config.adminPassword);

  if (!isValid) {
    limiter.recordFailure(ip);
    if (limiter.isRateLimited(ip)) {
      const retryAfter = limiter.getRetryAfterSeconds(ip);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many failed login attempts. Please try again later.',
        retryAfter,
      });
    }
    return res.status(401).json({ error: 'Invalid admin password' });
  }

  limiter.reset(ip);
  const token = createSessionToken({ role: 'admin' }, config.sessionSecret);

  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return res.json({ success: true, message: 'Logged in successfully' });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  return res.json({ success: true, message: 'Logged out successfully' });
});

authRouter.get('/status', (req, res) => {
  const token = req.cookies?.[config.cookieName];
  const session = verifySessionToken(token, config.sessionSecret);
  return res.json({ authenticated: Boolean(session) });
});

// Alias for frontend session check
authRouter.get('/session', (req, res) => {
  const token = req.cookies?.[config.cookieName];
  const session = verifySessionToken(token, config.sessionSecret);
  return res.json({ authenticated: Boolean(session) });
});
