import test from 'node:test';
import assert from 'node:assert/strict';
import { LoginRateLimiter } from '../src/rate-limiter.js';

test('LoginRateLimiter allows initial attempts and blocks after threshold', () => {
  const limiter = new LoginRateLimiter();
  const ip = '192.168.1.100';

  assert.equal(limiter.isRateLimited(ip), false);

  // Record 4 failed attempts
  for (let i = 0; i < 4; i++) {
    limiter.recordFailure(ip);
  }

  // Still not blocked at 4
  assert.equal(limiter.isRateLimited(ip), false);

  // 5th failure reaches maxAttempts threshold and triggers lockout
  limiter.recordFailure(ip);
  assert.equal(limiter.isRateLimited(ip), true);
  assert.ok(limiter.getRetryAfterSeconds(ip) > 0);
});

test('LoginRateLimiter reset clears failures for IP', () => {
  const limiter = new LoginRateLimiter();
  const ip = '192.168.1.101';

  for (let i = 0; i < 6; i++) {
    limiter.recordFailure(ip);
  }
  assert.equal(limiter.isRateLimited(ip), true);

  limiter.reset(ip);
  assert.equal(limiter.isRateLimited(ip), false);
  assert.equal(limiter.getRetryAfterSeconds(ip), 0);
});

test('LoginRateLimiter ignores expired attempts outside sliding window', () => {
  const limiter = new LoginRateLimiter();
  const ip = '192.168.1.102';
  const oldTime = Date.now() - (16 * 60 * 1000); // 16 mins ago

  // Manually push older timestamps
  limiter.attempts.set(ip, [oldTime, oldTime, oldTime, oldTime, oldTime, oldTime]);

  assert.equal(limiter.isRateLimited(ip), false);
  assert.equal(limiter.getRetryAfterSeconds(ip), 0);
});
