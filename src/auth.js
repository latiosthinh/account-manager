import crypto from 'node:crypto';

// ponytail: SHA-256 pre-hash before timingSafeEqual; upgrade to argon2/scrypt if storing hashed passwords in DB
export function verifyPassword(inputPassword, expectedPassword) {
  if (typeof inputPassword !== 'string' || typeof expectedPassword !== 'string') {
    return false;
  }
  if (!inputPassword || !expectedPassword) {
    return false;
  }

  const inputHash = crypto.createHash('sha256').update(inputPassword, 'utf8').digest();
  const expectedHash = crypto.createHash('sha256').update(expectedPassword, 'utf8').digest();

  return crypto.timingSafeEqual(inputHash, expectedHash);
}

// ponytail: HMAC-SHA256 stateless session; upgrade to DB session table if server-side revocation list needed
export function createSessionToken(payload, secret, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  if (!secret) throw new Error('Secret is required for session signing');
  const exp = Date.now() + maxAgeMs;
  const tokenPayload = { ...payload, exp };
  const rawPayload = Buffer.from(JSON.stringify(tokenPayload), 'utf8').toString('base64url');

  const sig = crypto.createHmac('sha256', secret).update(rawPayload).digest('base64url');
  return `${rawPayload}.${sig}`;
}

export function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [rawPayload, rawSig] = parts;
  if (!rawPayload || !rawSig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(rawPayload).digest('base64url');

  const rawSigBuffer = Buffer.from(rawSig, 'utf8');
  const expSigBuffer = Buffer.from(expectedSig, 'utf8');

  if (rawSigBuffer.length !== expSigBuffer.length) return null;
  if (!crypto.timingSafeEqual(rawSigBuffer, expSigBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
