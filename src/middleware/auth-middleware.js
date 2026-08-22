import { config } from '../config.js';
import { verifySessionToken } from '../auth.js';

// ponytail: single cookie auth; add Bearer token parsing if public API token support requested
export function requireAuth(req, res, next) {
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = verifySessionToken(token, config.sessionSecret);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = session;
  next();
}
