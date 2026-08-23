import { Router } from 'express';
import { config } from '../config.js';
import { verifyPassword, createSessionToken, verifySessionToken } from '../auth.js';
import { LoginRateLimiter } from '../rate-limiter.js';

export const authRouter = Router();
const limiter = new LoginRateLimiter(config.maxFailedLogins, config.lockoutWindowMs);
const pinLimiter = new LoginRateLimiter(config.maxFailedLogins, config.lockoutWindowMs);

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
    sameSite: 'lax',
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
  return res.json({
    authenticated: Boolean(session),
    hasPin: Boolean(config.pinCode),
    pinLength: config.pinCode ? config.pinCode.length : 0,
  });
});

// Alias for frontend session check
authRouter.get('/session', (req, res) => {
  const token = req.cookies?.[config.cookieName];
  const session = verifySessionToken(token, config.sessionSecret);
  return res.json({
    authenticated: Boolean(session),
    hasPin: Boolean(config.pinCode),
    pinLength: config.pinCode ? config.pinCode.length : 0,
  });
});

// Verify PIN code for revealing/copying passwords
authRouter.post('/verify-pin', (req, res) => {
  const token = req.cookies?.[config.cookieName];
  const session = verifySessionToken(token, config.sessionSecret);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please log in first.' });
  }

  // If no PIN_CODE is configured in .env, accept by default
  if (!config.pinCode) {
    return res.json({ success: true, message: 'No PIN configured' });
  }

  const ip = getClientIp(req);
  if (pinLimiter.isRateLimited(ip)) {
    const retryAfter = pinLimiter.getRetryAfterSeconds(ip);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many failed PIN attempts. Please try again later.',
      retryAfter,
    });
  }

  const { pin } = req.body || {};
  const isValid = verifyPassword(String(pin || ''), config.pinCode);

  if (!isValid) {
    pinLimiter.recordFailure(ip);
    if (pinLimiter.isRateLimited(ip)) {
      const retryAfter = pinLimiter.getRetryAfterSeconds(ip);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many failed PIN attempts. Please try again later.',
        retryAfter,
      });
    }
    return res.status(401).json({ error: 'Invalid PIN code' });
  }

  pinLimiter.reset(ip);
  return res.json({ success: true, message: 'PIN verified' });
});
