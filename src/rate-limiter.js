// ponytail: Map-based sliding window in memory; upgrade to Redis/SQLite store if multi-process or persistent rate limiting needed
export class LoginRateLimiter {
  constructor(defaultMaxAttempts = 5, defaultWindowMs = 15 * 60 * 1000) {
    this.defaultMaxAttempts = defaultMaxAttempts;
    this.defaultWindowMs = defaultWindowMs;
    this.attempts = new Map();
  }

  _prune(ip, now, windowMs) {
    const list = this.attempts.get(ip);
    if (!list || list.length === 0) {
      this.attempts.delete(ip);
      return [];
    }
    const cutoff = now - windowMs;
    const active = list.filter(ts => ts > cutoff);
    if (active.length === 0) {
      this.attempts.delete(ip);
    } else {
      this.attempts.set(ip, active);
    }
    return active;
  }

  isRateLimited(ip, maxAttempts = this.defaultMaxAttempts, windowMs = this.defaultWindowMs) {
    if (!ip) return false;
    const now = Date.now();
    const active = this._prune(ip, now, windowMs);
    return active.length >= maxAttempts;
  }

  recordFailure(ip, windowMs = this.defaultWindowMs) {
    if (!ip) return;
    const now = Date.now();
    const active = this._prune(ip, now, windowMs);
    active.push(now);
    this.attempts.set(ip, active);
  }

  reset(ip) {
    if (!ip) return;
    this.attempts.delete(ip);
  }

  getRetryAfterSeconds(ip, windowMs = this.defaultWindowMs) {
    if (!ip) return 0;
    const now = Date.now();
    const active = this._prune(ip, now, windowMs);
    if (active.length < this.defaultMaxAttempts) return 0;

    const oldest = active[0];
    const remainingMs = (oldest + windowMs) - now;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
  }
}
